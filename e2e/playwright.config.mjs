import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  timeout: 1_200_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    viewport: { width: 1280, height: 800 },
  },
});
