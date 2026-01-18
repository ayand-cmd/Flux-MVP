# 1. Use an official Node.js runtime as a parent image
# We use 'slim' to keep the file size small and cheap
FROM node:20-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package files first (better caching)
COPY package*.json ./

# 4. Install dependencies
# --production skips devDependencies like 'eslint' to save space
# BUT for TypeScript builds, we often need dev dependencies first. 
# Let's keep it simple for now and install everything.
RUN npm install

# 5. Copy the rest of your app source code
COPY . .

# 6. Build the TypeScript code (if you have a build script)
# If you don't have a specific build script, we can run using 'tsx' directly.
# Let's assume we run directly for the Vibe Coding approach.

# 7. The command to run when the container starts
# We use the same command you used on your laptop!
CMD ["npx", "tsx", "worker.ts"]