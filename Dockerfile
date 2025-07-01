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
# Manually add elan's bin directory to the system's PATH environment variable
ENV PATH="/root/.elan/bin:${PATH}"

# --- Set up the Unified Application Directory ---
WORKDIR /app

# Copy ALL project files (Node, LEAN, etc.) into the container's /app directory
COPY . .

# --- Build the LEAN Project ---
# Download pre-compiled 'olean' files for mathlib and build the project
# This is now run from within the unified /app directory
RUN lake exe cache get
RUN lake build

# --- Install Node.js Dependencies ---
# This is also run from within the unified /app directory
RUN npm install

# Expose port 3000 to allow traffic to the server
EXPOSE 3000

# Define the default command to run when the container starts
CMD ["npm", "start"]
