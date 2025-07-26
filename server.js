const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const { exec, spawn } = require('child_process'); // Import spawn
const path = 'path';

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
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
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

  const filename = `proof_${Date.now()}.lean`;
  const filepath = path.join(__dirname, filename);
  
  console.log(`Processing proof in: ${filepath}`);
  
  try {
    // Write the received proof to a temporary file
    await fs.writeFile(filepath, proof);
    
    // This function wraps the spawn process in a Promise to make it work with async/await
    const runLeanProcess = () => {
      return new Promise((resolve, reject) => {
        const command = '/root/.elan/bin/lake';
        const args = ['env', 'lean', filepath];

        // Use spawn for robust, streaming I/O. This is the core of the fix.
        const leanProcess = spawn(command, args, { 
          timeout: 300000 // 5-minute timeout
        });

        let stdout = '';
        let stderr = '';

        // Listen to the output streams in real-time
        leanProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        leanProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        // Handle process exit
        leanProcess.on('close', (code) => {
          if (code === 0) {
            // Success
            resolve({ stdout, stderr });
          } else {
            // Failure
            const error = new Error(`Process exited with code ${code}`);
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
          }
        });

        // Handle errors in starting the process itself
        leanProcess.on('error', (err) => {
          reject(err);
        });
      });
    };

    const { stdout, stderr } = await runLeanProcess();

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
        error: 'Proof execution timed out (5 minutes)',
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
