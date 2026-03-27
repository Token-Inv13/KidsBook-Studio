const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const exePath = path.join(__dirname, '..', 'dist', 'win-unpacked', 'KidsBook Studio.exe');
const candidatePorts = [3001, 3002, 3003];
const timeoutMs = 30000;

function assertWindowsExecutable() {
  if (process.platform !== 'win32') {
    throw new Error('This smoke test currently supports Windows packaged builds only.');
  }

  if (!fs.existsSync(exePath)) {
    throw new Error(`Packaged executable not found: ${exePath}`);
  }
}

function requestHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: 'localhost',
        family: 0,
        port,
        path: '/health',
        timeout: 2000
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }

          try {
            const data = JSON.parse(raw);
            resolve(data?.status === 'ok' ? { port, data } : null);
          } catch {
            resolve(null);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

async function waitForHealth() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const results = await Promise.all(candidatePorts.map((port) => requestHealth(port)));
    const match = results.find(Boolean);
    if (match) {
      return match;
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Health endpoint did not respond within ${timeoutMs}ms.`);
}

function killTree(pid) {
  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore'
    });

    killer.on('close', () => resolve());
    killer.on('error', () => resolve());
  });
}

async function main() {
  assertWindowsExecutable();

  const child = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    env: {
      ...process.env,
      KIDSBOOK_SMOKE_TEST: '1'
    },
    stdio: 'ignore'
  });

  let childExited = false;

  child.on('exit', (code) => {
    childExited = true;
    if (code && code !== 0) {
      // Intentionally left blank; the timeout/health check path will surface the failure.
    }
  });

  try {
    const health = await waitForHealth();
    if (childExited) {
      throw new Error('Packaged app exited before the health check completed.');
    }

    console.log(`Smoke test passed on port ${health.port}.`);
  } finally {
    await killTree(child.pid);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
