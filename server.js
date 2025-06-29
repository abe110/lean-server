const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for your web app
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check - test if server is working
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'LEAN server is running',
    timestamp: new Date().toISOString()
  });
});

// Main endpoint - receives proofs and runs LEAN
app.post('/execute', async (req, res) => {
  const { proof } = req.body;
  
  // Basic validation
  if (!proof || typeof proof !== 'string') {
    return res.json({
      success: false,
      error: 'No proof provided'
    });
  }

  // Create unique filename for this proof
  const timestamp = Date.now();
  const filename = `proof_${timestamp}.lean`;
  const filepath = path.join('/tmp', filename);
  
  console.log(`Processing proof: ${filename}`);
  
  try {
    // Write the proof to a temporary file
    fs.writeFileSync(filepath, proof);
    
    // Run LEAN on the file (30 second timeout)
    const command = `timeout 30s lean ${filepath}`;
    
    exec(command, { 
      maxBuffer: 1024 * 1024,  // 1MB output limit
      timeout: 35000           // 35 second total timeout
    }, (error, stdout, stderr) => {
      
      // Always clean up the temporary file
      try {
        fs.unlinkSync(filepath);
      } catch (cleanupError) {
        console.warn('Could not delete temp file:', cleanupError.message);
      }
      
      // Handle timeout
      if (error && (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM')) {
        console.log('Proof execution timed out');
        return res.json({
          success: false,
          error: 'Proof execution timed out (30 seconds)',
          diagnostics: stderr || ''
        });
      }
      
      // Handle other errors
      if (error) {
        console.log('LEAN execution error:', error.message);
        console.log('STDERR:', stderr);
        
        // Check if it's actually a success (LEAN sometimes reports success via stderr)
        const hasErrors = stderr && (
          stderr.includes('error:') || 
          stderr.includes('failed') ||
          stderr.includes('unknown identifier')
        );
        
        return res.json({
          success: !hasErrors,
          error: hasErrors ? stderr : null,
          diagnostics: stdout || stderr || '',
          output: stdout || ''
        });
      }
      
      // Success case
      console.log('LEAN execution successful');
      res.json({
        success: true,
        error: null,
        diagnostics: stdout || '',
        output: stdout || ''
      });
    });
    
  } catch (fileError) {
    // Clean up on error
    try {
      fs.unlinkSync(filepath);
    } catch (e) {}
    
    console.error('File error:', fileError.message);
    res.json({
      success: false,
      error: `Server error: ${fileError.message}`
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 LEAN server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Execute endpoint: http://localhost:${PORT}/execute`);
});