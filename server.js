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
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET', 'POST', 'OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type', 'Accept');
  res.sendStatus(200);
});

// --- API Routes ---
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

  // Define the file path relative to the current app directory
  const filename = `proof_${Date.now()}.lean`;
  const filepath = path.join(__dirname, filename);
  
  console.log(`Processing proof in: ${filepath}`);
  
  try {
    // Write the received proof to a temporary file
    await fs.writeFile(filepath, proof);
    
    // The command now uses the relative path
    const command = `lake env lean ${filepath}`;
    
    // We no longer need the `cwd` option, as we are already in the correct project directory.
    const { stdout, stderr } = await execPromise(command, { 
      timeout: 90000, // 90-second timeout
      maxBuffer: 1024 * 1024 // 1MB buffer for stdout/stderr
    });

    // Success case
    console.log('LEAN execution successful');
    res.json({
      success: true,
      error: null,
      diagnostics: stdout || stderr || '',
      output: stdout || ''
    });

  } catch (error) {
    // Handle timeout error specifically
    if (error.signal === 'SIGTERM' || error.killed) {
      console.log('Proof execution timed out');
      return res.status(408).json({
        success: false,
        error: 'Proof execution timed out (90 seconds)',
        diagnostics: error.stderr || ''
      });
    }

    // Handle other execution errors
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
      console.warn('Could not delete temp file:', cleanupError.message);
    }
  }
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`🚀 LEAN server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Execute endpoint: http://localhost:${PORT}/execute`);

  // Log the LEAN version on startup as a diagnostic check
  exec('lean --version', (err, stdout) => {
    if (err) {
      console.error("-> Could not get LEAN version. Is it in the PATH?");
      return;
    }
    console.log(`-> LEAN environment ready: ${stdout.trim()}`);
  });
});
