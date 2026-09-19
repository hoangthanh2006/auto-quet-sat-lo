import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OCR_SERVER_SCRIPT = path.join(__dirname, 'ocr_server.py');
const DAEMON_PORT = 3003;
let daemonProcess = null;

export function getPythonPath() {
  const venvPythonMac = path.join(__dirname, 'venv', 'bin', 'python3');
  const venvPythonWin = path.join(__dirname, 'venv', 'Scripts', 'python.exe');

  if (fs.existsSync(venvPythonMac)) return venvPythonMac;
  if (fs.existsSync(venvPythonWin)) return venvPythonWin;

  return 'python3';
}

/**
 * Ensure persistent Python OCR daemon is running on port 3003
 */
export function ensureDaemonRunning() {
  return new Promise((resolve) => {
    // Check if daemon is already responding
    const req = http.get(`http://127.0.0.1:${DAEMON_PORT}/status`, (res) => {
      if (res.statusCode === 200) {
        return resolve(true);
      }
      spawnDaemon(resolve);
    });

    req.on('error', () => {
      spawnDaemon(resolve);
    });

    req.end();
  });
}

function spawnDaemon(resolve) {
  if (daemonProcess) {
    return resolve(true);
  }

  const pythonPath = getPythonPath();
  console.log(`Starting persistent OCR Daemon: ${pythonPath} ${OCR_SERVER_SCRIPT}...`);

  daemonProcess = spawn(pythonPath, [OCR_SERVER_SCRIPT], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  daemonProcess.on('exit', (code) => {
    console.log(`OCR Daemon exited with code ${code}`);
    daemonProcess = null;
  });

  // Give daemon 1.5 seconds to start up & bind port
  setTimeout(() => resolve(true), 1500);
}

/**
 * Check OCR Daemon status
 */
export async function getOcrStatus() {
  await ensureDaemonRunning();
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${DAEMON_PORT}/status`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message, ready: false });
    });

    req.end();
  });
}

/**
 * Execute ultra-fast OCR scan via persistent Python daemon
 */
export async function executeOcrScan(filePath, options = {}) {
  await ensureDaemonRunning();

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Input file not found: ${filePath}`));
    }

    const payload = JSON.stringify({
      filePath,
      forceOcr: options.forceOcr === true || options.forceOcr === 'true',
      langs: options.langs || 'vi,en',
      engine: options.engine || 'auto',
      isHandwritten: options.isHandwritten === true || options.isHandwritten === 'true'
    });

    const req = http.request(
      `http://127.0.0.1:${DAEMON_PORT}/scan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 120000 // 2 minutes
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (res.statusCode === 200 && result.success) {
              resolve(result);
            } else {
              reject(new Error(result.error || 'OCR scan failed'));
            }
          } catch (e) {
            reject(new Error(`Invalid response from OCR daemon: ${e.message}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`Không thể kết nối đến OCR Daemon (127.0.0.1:${DAEMON_PORT} - ${err.message}). Máy chủ Python OCR chưa khởi động được do thiếu thư viện Python trên môi trường máy chủ. Hướng dẫn khắc phục: Chạy 'pip install -r requirements.txt' hoặc deploy qua Dockerfile.`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OCR scanning request timed out after 2 minutes'));
    });

    req.write(payload);
    req.end();
  });
}

// Auto-start daemon on module load
ensureDaemonRunning();
