# Use a single, stable Ubuntu base image for the entire process
FROM ubuntu:22.04

# Set non-interactive mode for package installations to prevent prompts
ENV DEBIAN_FRONTEND=noninteractive

# --- Install ALL System Dependencies First ---
# This layer rarely changes and will be cached.
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Install Modern Node.js ---
# This layer also rarely changes.
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# --- Install LEAN ---
# This layer also rarely changes.
RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --no-modify-path

# Set the robust PATH for the rest of the build.
ENV PATH="/root/.elan/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# --- Set up the Application Directory ---
WORKDIR /app

# --- Optimized Dependency Installation ---
# By copying only the necessary files for each step, we maximize caching.

# 1. Install Node.js dependencies. This layer only rebuilds if package.json changes.
COPY package*.json ./
RUN npm install

# 2. Build the LEAN project. This very slow layer only rebuilds if the LEAN config files change.
COPY lakefile.lean lean-toolchain Main.lean ./
RUN lake exe cache get
RUN lake build

# 3. Copy the rest of the application code.
# This is the layer that will change most often. By copying it last,
# we avoid re-running the slow dependency installations above.
COPY . .

# --- Final Configuration ---
# Expose port 3000 to allow traffic to the server
EXPOSE 3000

# Define the default command to run when the container starts
CMD ["npm", "start"]
