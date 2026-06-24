FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the application source code
COPY . .

# Expose the backend port
EXPOSE 3000

# Start the server directly
CMD ["node", "server.js"]
