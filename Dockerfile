# Use a single, stable Ubuntu base image for the entire process
FROM ubuntu:22.04

# Set non-interactive mode for package installations to prevent prompts
ENV DEBIAN_FRONTEND=noninteractive

# --- Install ALL Dependencies at Once ---
# Install system dependencies for both LEAN and Node.js
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Install Modern Node.js ---
# Use the official NodeSource script to add the repository for Node.js v18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
# Now, install Node.js v18 (which includes npm)
RUN apt-get install -y nodejs

# --- Install LEAN ---
# Install elan, the LEAN version manager
RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --no-modify-path
# Set a robust and explicit PATH to ensure all executables are found.
ENV PATH="/root/.elan/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# --- Set up the Application Directory ---
WORKDIR /app

# --- THE FIX IS HERE ---
# 1. Copy ALL project files first.
# This ensures that `lakefile.lean`, `ProofVerify/ProofVerify.lean`, etc., are all present.
COPY . .

# 2. Now, install dependencies.
RUN npm install

# 3. Now, build the LEAN project. This will succeed because all files are present.
RUN lake exe cache get
RUN lake build

# --- Final Configuration ---
# Expose port 3000 to allow traffic to the server
EXPOSE 3000

# Define the default command to run when the container starts
CMD ["npm", "start"]
