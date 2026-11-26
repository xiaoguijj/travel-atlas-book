#!/usr/bin/env node
/**
 * 把当前生产构建复制到 gitignored 的 `demo/current/`，作为本地离线演示备份。
 * 备份只包含静态产物，不复制源码、node_modules 或任何密钥。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceDir = resolve(projectRoot, process.env.DEMO_DIST ?? 'dist');
const targetDir = resolve(projectRoot, 'demo', 'current');
const previousDir = resolve(projectRoot, 'demo', 'previous');

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

try {
  await stat(resolve(sourceDir, 'index.html'));
} catch {
  console.error(`[demo] 没有找到 ${resolve(sourceDir, 'index.html')}，请先运行 npm run build。`);
  process.exit(1);
}

// 保留上一份已验证备份，便于演示当天一键回退。
await rm(previousDir, { recursive: true, force: true });
try {
  await rename(targetDir, previousDir);
} catch (error) {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
}

await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });

const files = await collectFiles(targetDir);
let totalBytes = 0;
for (const file of files) totalBytes += (await stat(file)).size;

const indexPath = resolve(targetDir, 'index.html');
const indexHash = createHash('sha256').update(await readFile(indexPath)).digest('hex');
const builtAt = new Date().toISOString();
const commit = gitCommit();

const buildInfo = [
  'Travel Atlas Book — 本地离线演示备份',
  '',
  `打包时间: ${builtAt}`,
  `构建提交: ${commit}`,
  `来源目录: ${relative(projectRoot, sourceDir) || '.'}`,
  `文件数量: ${files.length}`,
  `总大小: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
  `index.html SHA-256: ${indexHash}`,
  '',
  '运行方式:',
  '  npm run demo:local -- --dist demo/current',
  '  打开 http://127.0.0.1:4173/',
  '',
  '说明:',
  '  - 这是当前 dist/ 的静态副本，不是源码备份；重新构建后请再次运行 npm run demo:backup。',
  '  - 上一份备份保留在 demo/previous/；需要回退时运行 npm run demo:local -- --dist demo/previous。',
  '  - 演示数据保存在浏览器 IndexedDB 中，换浏览器或清理站点数据会回到空档案。',
  '  - 页面使用 hash 路由，可直接通过 #/ 后的地址恢复城市、手账和行程。',
  '',
].join('\n');

await writeFile(resolve(targetDir, 'BUILD.txt'), buildInfo, 'utf8');

console.log(`[demo] 离线备份已生成: ${targetDir}`);
console.log(`[demo] 文件 ${files.length} 个，共 ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log('[demo] 启动: npm run demo:local -- --dist demo/current');
