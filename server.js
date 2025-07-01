const express = require('express');
const cors = require('cors');
const fs = require('fs/promises'); // Using the promises-based version of the 'fs' module
const { exec } = require('child_process');
const path = require('path');
const util = require('util'); // Required for promisify

// Convert the callback-based `exec` function into a promise-based one for use with async/await
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware Setup ---
// Enable Cross-Origin Resource Sharing (CORS) for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: false
}));
// Enable parsing of JSON bodies with a size limit of 10mb
app.use(express.json({ limit: '10mb' }));
// Handle preflight 'OPTIONS' requests automatically for CORS
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.sendStatus(200);
});

// --- API Routes ---
// Health check endpoint to confirm the server is running
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'LEAN server is running',
    timestamp: new Date().toISOString()
  });
});

// Main endpoint to receive and execute LEAN proofs
app.post('/execute', async (req, res) => {
  const { proof } = req.body;
  
  if (!proof || typeof proof !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'No proof provided or invalid format'
    });
  }

  // Define the directory where the LEAN project lives inside the container
  const leanProjectDir = '/lean_project';
  const filename = `proof_${Date.now()}.lean`;
  const filepath = path.join(leanProjectDir, filename);
  
  console.log(`Processing proof in: ${filepath}`);
  
  try {
    // Write the received proof to a temporary file inside the LEAN project directory
    await fs.writeFile(filepath, proof);
    
    // The command to execute: use 'lake env lean' to run LEAN with project dependencies (mathlib).
    // 'timeout 30s' ensures the process is killed if it runs too long.
    const command = `timeout 30s lake env lean ${filepath}`;
    
    // Execute the command from within the project directory
    const { stdout, stderr } = await execPromise(command, { 
      cwd: leanProjectDir,
      timeout: 35000, // 35-second total timeout for the exec call itself
      maxBuffer: 1024 * 1024 // 1MB buffer for stdout/stderr
    });

    // Success case
    console.log('LEAN execution successful');
    res.json({
      success: true,
      error: null,
      diagnostics: stdout || stderr || '', // LEAN often puts useful info in stderr even on success
      output: stdout || ''
    });

  } catch (error) {
    // This block catches errors from both fs.writeFile and execPromise
    
    // Handle timeout error specifically
    if (error.signal === 'SIGTERM' || error.code === 124) { // 'timeout' command exits with code 124
      console.log('Proof execution timed out');
      return res.status(408).json({
        success: false,
        error: 'Proof execution timed out (30 seconds)',
        diagnostics: error.stderr || ''
      });
    }

    // Handle other execution errors (e.g., LEAN compilation errors)
    console.log('LEAN execution error:', error.message);
    console.log('STDERR:', error.stderr);
    
    res.status(422).json({
      success: false,
      error: error.stderr || 'An unexpected execution error occurred.',
      diagnostics: error.stdout || error.stderr || '',
      output: error.stdout || ''
    });

  } finally {
    // Always attempt to clean up the temporary file
    try {
      await fs.unlink(filepath);
    } catch (cleanupError) {
      // Log a warning if the file couldn't be deleted, but don't crash
      console.warn('Could not delete temp file:', cleanupError.message);
    }
  }
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`🚀 LEAN server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Execute endpoint: http://localhost:${PORT}/execute`);

  // Log the LEAN version on startup as a diagnostic check to confirm it's installed correctly
  exec('lean --version', (err, stdout) => {
    if (err) {
      console.error("-> Could not get LEAN version. Is it in the PATH?");
      return;
    }
    console.log(`-> LEAN environment ready: ${stdout.trim()}`);
  });
});
