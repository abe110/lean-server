const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const { exec, spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// ** CHANGE IS HERE **
// The directory now matches the library name defined in lakefile.lean
const PROOFS_DIR = path.join(__dirname, 'LeanServerContainer');

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
  const filepath = path.join(PROOFS_DIR, filename);
  
  console.log(`Processing proof in: ${filepath}`);
  
  try {
    await fs.writeFile(filepath, proof);
    
    const runLeanProcess = () => {
      return new Promise((resolve, reject) => {
        // ** CHANGE IS HERE **
        // The module name now correctly reflects the new directory structure.
        const moduleName = `LeanServerContainer.${path.basename(filename, '.lean')}`;
        
        const command = 'nice';
        const args = ['-n', '10', '/root/.elan/bin/lake', 'build', moduleName];

        console.log(`Running command: ${command} ${args.join(' ')}`);

        const leanProcess = spawn(command, args, { 
          timeout: 300000 // 5-minute timeout
        });

        let stdout = '';
        let stderr = '';

        leanProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        leanProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        leanProcess.on('close', (code) => {
          const hasError = stderr.toLowerCase().includes('error:');
          if (code === 0 && !hasError) {
            resolve({ stdout, stderr });
          } else {
            const error = new Error(`Process exited with code ${code}`);
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
          }
        });

        leanProcess.on('error', (err) => {
          reject(err);
        });
      });
    };

    const { stdout, stderr } = await runLeanProcess();

    console.log('LEAN execution successful');
    res.json({
      success: true,
      error: null,
      diagnostics: stdout || stderr || '',
      output: stdout || ''
    });

  } catch (error) {
    if (error.signal === 'SIGTERM' || error.killed) {
      console.log('Proof execution timed out');
      return res.status(408).json({
        success: false,
        error: 'Proof execution timed out (5 minutes)',
        diagnostics: error.stderr || ''
      });
    }

    console.log('LEAN execution error:', error.message);
    console.log('STDERR:', error.stderr);
    
    res.status(422).json({
      success: false,
      error: error.stderr || 'An unexpected execution error occurred.',
      diagnostics: error.stdout || error.stderr || '',
      output: error.stdout || ''
    });

  } finally {
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
  
  try {
    await fs.mkdir(PROOFS_DIR, { recursive: true });
    console.log(`✅ Proofs directory is ready at ${PROOFS_DIR}`);
  } catch (error) {
    console.error('❌ Failed to create Proofs directory:', error);
  }

  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Execute endpoint: http://localhost:${PORT}/execute`);

  exec('lean --version', (err, stdout) => {
    if (err) {
      console.error("-> Could not get LEAN version. Is it in the PATH?");
      return;
    }
    console.log(`-> LEAN environment ready: ${stdout.trim()}`);
  });
});
