FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy app source code
COPY . .

# Expose port 8080
EXPOSE 8080

# Use wait-for-it.sh to wait for postgres before starting the app
CMD ["npm", "start"]
