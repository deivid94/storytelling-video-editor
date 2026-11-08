import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'api',
      command: 'pnpm --filter api dev',
      url: 'http://127.0.0.1:3333/api/health',
      // Nunca reaproveita um servidor de dev, que usaria o Claude de verdade.
      reuseExistingServer: false,
      env: { SCRIPT_INTERPRETER: 'fake', DATA_DIR: '../../test-results/e2e-data' },
      timeout: 120_000,
    },
    {
      name: 'web',
      command: 'pnpm --filter web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
