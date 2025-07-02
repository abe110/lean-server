# Use a single, stable Ubuntu base image for the entire process
FROM ubuntu:22.04

# Set non-interactive mode for package installations to prevent prompts
ENV DEBIAN_FRONTEND=noninteractive

# --- Install ALL Dependencies at Once ---
# MODIFIED: Added 'strace' to the list of packages to install.
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    ca-certificates \
    strace \
    && rm -rf /var/lib/apt/lists/*

# --- Install Modern Node.js ---
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# --- Install LEAN ---
RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --no-modify-path
ENV PATH="/root/.elan/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# --- Set up the Unified Application Directory ---
WORKDIR /app

# Copy ALL project files (Node, LEAN, etc.) into the container's /app directory
COPY . .

# --- Build the LEAN Project ---
RUN lake exe cache get
RUN lake build

# --- Install Node.js Dependencies ---
RUN npm install

# Expose port 3000 to allow traffic to the server
EXPOSE 3000

# Define the default command to run when the container starts
CMD ["npm", "start"]
