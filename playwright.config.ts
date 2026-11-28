import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;
const staticRootPort = 4174;
const staticSubpathPort = 4175;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // 地球贴图绘制和 WebGL 渲染都是 CPU 大户，核多的机器默认开 8 个 worker
  // 会互相拖慢帧率，把依赖帧推进的交互测试拖到超时；固定成 CI 常见的 4 路并行。
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    // V1-11：本地静态服务器分别模拟根路径部署和子路径部署。
    // 两者都直接读取同一个 dist/，确保静态产物不依赖 dev server。
    {
      command: `node scripts/serve-dist.mjs --host 127.0.0.1 --port ${staticRootPort}`,
      url: `http://127.0.0.1:${staticRootPort}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `node scripts/serve-dist.mjs --host 127.0.0.1 --port ${staticSubpathPort} --base-path /atlas`,
      url: `http://127.0.0.1:${staticSubpathPort}/atlas/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
