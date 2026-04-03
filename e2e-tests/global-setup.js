const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async () => {
  const rootDir = path.join(__dirname, '..');
  const resultsRoot = path.join(rootDir, 'test-results');
  const screenshotRoot = path.join(resultsRoot, 'screenshots');
  const playwrightRoot = path.join(resultsRoot, 'playwright');

  fs.mkdirSync(screenshotRoot, { recursive: true });
  fs.mkdirSync(playwrightRoot, { recursive: true });

  if (process.env.KIDSBOOK_E2E_SKIP_BUILD === '1') {
    return;
  }

  execSync('npm run build', {
    cwd: rootDir,
    stdio: 'inherit'
  });
};
