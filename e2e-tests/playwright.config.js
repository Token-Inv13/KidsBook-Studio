const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'specs'),
  globalSetup: path.join(__dirname, 'global-setup.js'),
  timeout: 10 * 60 * 1000,
  expect: {
    timeout: 30 * 1000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(__dirname, '..', 'test-results', 'playwright', 'results.json') }]
  ],
  outputDir: path.join(__dirname, '..', 'test-results', 'playwright', 'artifacts'),
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
