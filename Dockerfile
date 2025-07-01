# Use a stable Ubuntu base image
FROM ubuntu:22.04

# Set non-interactive mode for package installations to prevent prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install essential system dependencies for Node.js and LEAN
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    nodejs \
    npm \
    coreutils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install elan, the LEAN version manager. This will install LEAN itself.
# The -y flag accepts defaults, and --no-modify-path prevents it from trying to edit shell files.
RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --no-modify-path

# Manually add elan's bin directory to the system's PATH environment variable
ENV PATH="/root/.elan/bin:${PATH}"

# --- Create and build the LEAN project to get mathlib ---
# Set the working directory for the LEAN project
WORKDIR /lean_project

# Copy the LEAN project configuration files into the container
COPY lean-toolchain lakefile.lean Main.lean ./

# Use the 'lake' build tool to download pre-compiled 'olean' files for mathlib
# This is a critical step for performance, as it avoids compiling mathlib from scratch.
RUN lake exe cache get

# Build the LEAN project. This ensures all dependencies are correctly linked.
RUN lake build

# --- Set up the Node.js web server ---
# Switch the working directory for the Node.js application
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the Node.js dependencies defined in package.json
RUN npm install

# Copy the server's source code
COPY server.js ./

# Expose port 3000 to allow traffic to the server
EXPOSE 3000

# Define the default command to run when the container starts
CMD ["npm", "start"]
