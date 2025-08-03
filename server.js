const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const { exec, spawn } = require('child_process'); // Import spawn
const path = require('path'); // Correctly require the 'path' module

const app = express();
const PORT = process.env.PORT || 3000;
const PROOFS_DIR = path.join(__dirname, 'Proofs');

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

  // Use a consistent filename but place it in the 'Proofs' subdirectory
  const filename = `proof_${Date.now()}.lean`;
  const filepath = path.join(PROOFS_DIR, filename);
  
  console.log(`Processing proof in: ${filepath}`);
  
  try {
    // Write the received proof to the temporary file inside the Proofs directory
    await fs.writeFile(filepath, proof);
    
    // This function wraps the spawn process in a Promise to make it work with async/await
    const runLeanProcess = () => {
      return new Promise((resolve, reject) => {
        // ** THE FIX IS HERE **
        // We now build the file as a module within the project, which resolves imports.
        // The module name is derived from the folder and filename.
        const moduleName = `Proofs.${path.basename(filename, '.lean')}`;
        
        const command = 'nice';
        // The new arguments tell `lake` to `build` our specific module.
        const args = ['-n', '10', '/root/.elan/bin/lake', 'build', moduleName];

        console.log(`Running command: ${command} ${args.join(' ')}`);

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
          // `lake build` outputs warnings to stderr even on success, so we check for specific error text.
          const hasError = stderr.toLowerCase().includes('error:');
          if (code === 0 && !hasError) {
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
app.listen(PORT, async () => {
  console.log(`🚀 LEAN server running on port ${PORT}`);
  
  // Ensure the 'Proofs' directory exists on startup
  try {
    await fs.mkdir(PROOFS_DIR, { recursive: true });
    console.log(`✅ Proofs directory is ready at ${PROOFS_DIR}`);
  } catch (error) {
    console.error('❌ Failed to create Proofs directory:', error);
  }

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
