# Use Node.js image
FROM node:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port used by your application
EXPOSE 3000

# Start the React development server
CMD ["npm", "start"]
