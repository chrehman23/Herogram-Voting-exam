
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');
const promClient = require('prom-client');
require('dotenv').config();

let activeUsers = 0
// ************************************************************
const app = express();
app.use(cors({
    origin: '*',
}));
const server = http.createServer(app);
// ************************************************************
const io = new Server(server, {
    cors: { origin: '*' }
});
// ************************************************************ 
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432,
});

// ************************************************************

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: '*' }));

// ************************************************************
const requestCounter = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status']
});
// ************************************************************
const latencyHistogram = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Request latency in seconds',
    labelNames: ['method', 'route', 'status']
});
// ************************************************************
app.use((req, res, next) => {
    const end = latencyHistogram.startTimer({ method: req.method, route: req.path });
    res.on('finish', () => {
        requestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
        end({ status: res.statusCode });
    });
    next();
});
// ************************************************************
async function migrate() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS polls (
        id UUID PRIMARY KEY,
        question TEXT NOT NULL,
        options TEXT[] NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
        );
      CREATE TABLE IF NOT EXISTS votes (
        poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        option_idx INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (poll_id, user_id)
        );
        `);
        console.log('Database migrations completed successfully');
    } catch (error) {
        console.error('Database migration failed:', error);
        process.exit(1);
    }
}
// ************************************************************
async function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing token' });
    }
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
}
async function voteRateLimit(req, res, next) {
    const userId = req.user.userId;
    const key = `ratelimit:vote:${userId}`;
    const limit = 5;
    const window = 60;
    const now = Math.floor(Date.now() / 1000);
    try {
        const tx = redis.multi();
        tx.zadd(key, now, `${now}:${Math.random()}`);
        tx.zremrangebyscore(key, 0, now - window);
        tx.zcard(key);
        tx.expire(key, window * 2);
        const results = await tx.exec();
        if (!results || results.some(r => r[0])) {
            throw new Error('Redis transaction failed');
        }
        const count = results[2][1];
        if (count > limit) {
            return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
        }
        next();
    } catch (error) {
        console.error('Rate limit error:', error);
        // Don't block the request if rate limiting fails
        next();
    }
}
const getPollInformation = async (pollId, userId = null) => {
    try {
        const pollRes = await pool.query('SELECT * FROM polls WHERE id=$1', [pollId]);
        if (!pollRes.rows.length) {
            return { error: 'Poll not found', statusCode: 404 };
        }
        const poll = pollRes.rows[0];

        // Get vote counts properly grouped by option_idx
        const votesRes = await pool.query(
            'SELECT option_idx, COUNT(*) as count FROM votes WHERE poll_id=$1 GROUP BY option_idx ORDER BY option_idx',
            [pollId]
        );

        // Initialize tally array with zeros for all options
        const tally = Array(poll.options.length).fill(0);

        // Fill in the actual vote counts
        votesRes.rows.forEach(row => {
            if (row.option_idx >= 0 && row.option_idx < tally.length) {
                tally[row.option_idx] = parseInt(row.count, 10);
            }
        });

        // Get the user's vote if userId is provided
        let votedIndex = null;
        if (userId) {
            const userVoteRes = await pool.query(
                'SELECT option_idx FROM votes WHERE poll_id=$1 AND user_id=$2',
                [pollId, userId]
            );
            if (userVoteRes.rows.length > 0) {
                votedIndex = userVoteRes.rows[0].option_idx;
            }
        }

        return {
            id: poll.id,
            question: poll.question,
            options: poll.options,
            expiresAt: poll.expires_at,
            createdAt: poll.created_at,
            votes: tally,
            votedIndex,
            closed: new Date(poll.expires_at) < new Date(),
            userId: userId
        };
    } catch (error) {
        console.error('Error getting poll information:', error);
        return { error: 'Database error', statusCode: 500 };
    }
};
app.get('/api/v1/auth/login', (req, res) => {
    const userId = uuidv4();
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, userId });
});
app.post('/api/v1/poll', authMiddleware, async (req, res) => {
    const { question, options, expiresAt } = req.body;
    // Validate input
    if (!question || !Array.isArray(options) || options.length < 2 || !expiresAt) {
        return res.status(400).json({ error: 'Invalid payload. Required: question, options array (min 2), and expiresAt' });
    }
    // Additional validation
    if (options.some(option => !option || typeof option !== 'string')) {
        return res.status(400).json({ error: 'All options must be non-empty strings' });
    }
    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
        return res.status(400).json({ error: 'expiresAt must be a valid future date' });
    }
    const id = uuidv4();
    try {
        await pool.query(
            'INSERT INTO polls (id, question, options, expires_at) VALUES ($1, $2, $3, $4)',
            [id, question, options, expiryDate]
        );
        const newPoll = await getPollInformation(id, req.user.userId);
        if (newPoll.error) {
            return res.status(newPoll.statusCode).json({ error: newPoll.error });
        }
        // Emit socket event with new poll data
        io.emit("POLL_REGISTER", newPoll);
        res.status(201).json({ id, poll: newPoll });
    } catch (error) {
        console.error('Error creating poll:', error);
        res.status(500).json({ error: 'Database error' });
    }
});
app.get('/api/v1/polls', authMiddleware, async (req, res) => {
    try {
        if (!req?.user?.userId) {
            res.status(500).json({ error: 'USER ID issue error' });
            return;
        }

        const pollsRes = await pool.query('SELECT * FROM polls ORDER BY created_at DESC');
        const polls = await Promise.all(pollsRes.rows.map(async (poll) => {
            return await getPollInformation(poll.id, req.user.userId);
        }));

        // Filter out any error results
        const validPolls = polls.filter(poll => !poll.error);
        res.json({ polls: validPolls });
    } catch (error) {
        console.error('Error fetching polls:', error);
        res.status(500).json({ error: 'Database error' });
    }
});
app.get('/api/v1/poll/:id', authMiddleware, async (req, res) => {
    const pollId = req.params.id;
    try {
        const poll = await getPollInformation(pollId, req.user.userId);
        if (poll.error) {
            return res.status(poll.statusCode).json({ error: poll.error });
        }
        res.json(poll);
    } catch (error) {
        console.error('Error fetching poll:', error);
        res.status(500).json({ error: 'Database error' });
    }
});
app.post('/api/v1/poll/:id/vote', authMiddleware, voteRateLimit, async (req, res) => {
    const pollId = req.params.id;
    const { optionIdx } = req.body;
    const userId = req.user.userId;

    // Input validation
    if (typeof optionIdx !== 'number') {
        return res.status(400).json({ error: 'optionIdx must be a number' });
    }

    // Use a transaction to ensure vote integrity
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check if poll exists and isn't expired
        const pollRes = await client.query('SELECT * FROM polls WHERE id=$1', [pollId]);
        if (!pollRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Poll not found' });
        }

        const poll = pollRes.rows[0];
        if (new Date(poll.expires_at) < new Date()) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Poll is closed' });
        }

        // Check if option is valid
        if (optionIdx < 0 || optionIdx >= poll.options.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid option index' });
        }

        // Check if user already voted on this poll
        const userVoteRes = await client.query(
            'SELECT option_idx FROM votes WHERE poll_id=$1 AND user_id=$2 FOR UPDATE',
            [pollId, userId]
        );

        let action = 'voted';
        let votedIndex = optionIdx;

        if (userVoteRes.rows.length > 0) {
            const prevOptionIdx = userVoteRes.rows[0].option_idx;

            // User is trying to vote for the same option
            if (optionIdx === prevOptionIdx) {
                await client.query('COMMIT');
                const updatedPoll = await getPollInformation(pollId, userId);
                if (updatedPoll.error) {
                    return res.status(updatedPoll.statusCode).json({ error: updatedPoll.error });
                }
                io.emit("VOTED", updatedPoll);
                res.json({ ok: true, action: 'no_change', message: 'No change in vote', votedIndex });
                return;
            }

            // User is changing their vote
            await client.query(
                'UPDATE votes SET option_idx=$1 WHERE poll_id=$2 AND user_id=$3',
                [optionIdx, pollId, userId]
            );
            action = 'changed_vote';
            votedIndex = optionIdx;
        } else {
            // User is voting for the first time
            await client.query(
                'INSERT INTO votes (poll_id, user_id, option_idx) VALUES ($1, $2, $3)',
                [pollId, userId, optionIdx]
            );
        }

        await client.query('COMMIT');

        // Get updated poll information
        const updatedPoll = await getPollInformation(pollId, userId);
        if (updatedPoll.error) {
            return res.status(updatedPoll.statusCode).json({ error: updatedPoll.error });
        }

        io.emit("VOTED", updatedPoll);

        res.json({ ok: true, action, message: action === 'changed_vote' ? 'Vote changed successfully' : 'Vote recorded successfully', votedIndex });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error voting on poll:', error);
        res.status(500).json({ error: 'Database error' });
    } finally {
        client.release();
    }
});
app.get('/api/v1/metrics', async (req, res) => {
    return res.status(200).json({
        message: 'Application metrics',
        activeUsers
    });
});
io.on('connection', (socket) => {
    console.log("New user connected:", socket.id);
    activeUsers++
    io.emit("USER_LIST", { activeUsers })
    socket.on('disconnect', () => {
        activeUsers--
        console.log("User disconnected:", socket.id);
        io.emit("USER_LIST", { activeUsers })
    });
});

setInterval(async () => {// to delete expire list.
    try {
        const now = new Date();
        const oneWeekAgo = new Date(now - 1000 * 60 * 60 * 24 * 7);
        const result = await pool.query(
            `DELETE FROM polls WHERE expires_at < $1 AND expires_at < $2 RETURNING id`,
            [now, oneWeekAgo]
        );
        if (result.rows.length > 0) {
            console.log(`Cleaned up ${result.rows.length} expired polls`);
        }
    } catch (error) {
        console.error('Error cleaning up expired polls:', error);
    }
}, 1000 * 60 * 60 * 24);


app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ error: 'Internal server error' });
});
async function startServer() {
    await migrate();
    const port = process.env.PORT || 8080;
    server.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
}); 