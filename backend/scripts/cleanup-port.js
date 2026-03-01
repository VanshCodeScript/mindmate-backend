#!/usr/bin/env node

/**
 * Port cleanup script - Kills any process using the development port
 * Usage: node scripts/cleanup-port.js [port]
 */

const net = require('net');
const { execSync } = require('child_process');
const os = require('os');

const PORT = process.env.PORT || 5004;

const checkPortInUse = () => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${PORT} is in use. Attempting cleanup...`);
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      console.log(`✅ Port ${PORT} is free`);
      resolve(false);
    });

    server.listen(PORT);
  });
};

const killPortProcess = () => {
  try {
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows
      try {
        execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf-8' });
        const cmd = `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${PORT}') do taskkill /F /PID %a`;
        execSync(cmd, { shell: 'cmd.exe', stdio: 'pipe' });
        console.log(`✅ Killed process on port ${PORT}`);
      } catch (error) {
        // Process not found or already killed
        console.log(`✅ No processes to kill on port ${PORT}`);
      }
    } else if (platform === 'darwin' || platform === 'linux') {
      // macOS/Linux
      try {
        execSync(`lsof -ti :${PORT} | xargs kill -9`, { stdio: 'pipe' });
        console.log(`✅ Killed process on port ${PORT}`);
      } catch (error) {
        console.log(`✅ No processes to kill on port ${PORT}`);
      }
    }
  } catch (error) {
    console.error('Error killing port process:', error.message);
  }
};

const main = async () => {
  console.log(`🔍 Checking port ${PORT}...`);
  const inUse = await checkPortInUse();

  if (inUse) {
    killPortProcess();
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`🎯 Port ${PORT} is ready for development`);
};

main();
