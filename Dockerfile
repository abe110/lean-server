# --- Stage 1: The Builder ---
# This stage will install all build-time dependencies and build our LEAN project.
FROM ubuntu:22.04 AS builder

# Set non-interactive mode for package installations
ENV DEBIAN_FRONTEND=noninteractive

# Install essential system dependencies for LEAN
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install elan, the LEAN version manager
RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --no-modify-path
ENV PATH="/root/.elan/bin:${PATH}"

# Set the working directory for the LEAN project
WORKDIR /lean_project

# Copy the LEAN project configuration files
COPY lean-toolchain lakefile.lean Main.lean ./

# Download pre-compiled 'olean' files for mathlib and build the project
RUN lake exe cache get
RUN lake build

# --- Stage 2: The Final Image ---
# This stage will be our small, efficient runtime environment.
FROM ubuntu:22.04

# Set non-interactive mode for package installations
ENV DEBIAN_FRONTEND=noninteractive

# Install only the runtime dependencies: Node.js and ca-certificates
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory for our Node.js application
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the Node.js dependencies
RUN npm install

# Copy the server's source code
COPY server.js ./

# --- Copy the built LEAN project from the 'builder' stage ---
# This is the key step: we copy the pre-built project into our final image
COPY --from=builder /lean_project /lean_project
# Also copy the elan installation, which contains the 'lean' and 'lake' executables
COPY --from=builder /root/.elan /root/.elan

# Add elan's bin directory to the PATH in our final image
ENV PATH="/root/.elan/bin:${PATH}"

# Expose port 3000 to allow traffic to the server
EXPOSE 3000

# Define the default command to run when the container starts
CMD ["npm", "start"]
