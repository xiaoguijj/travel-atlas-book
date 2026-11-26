#!/usr/bin/env node
/**
 * 无依赖静态服务器，用于本地离线演示与静态托管自检。
 *
 * 站点使用 hash 路由，服务器只负责把 `dist/` 原样提供出来；因此根路径和
 * 子路径部署（例如 Qoder Sites 的 `/atlas`）都不需要额外的 rewrite 规则。
 *
 * 用法：
 *   npm run demo:local
 *   npm run demo:local -- --dist demo/current --port 4173
 *   node scripts/serve-dist.mjs --base-path /atlas --port 4175
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function fail(message) {
  console.error(`[demo] ${message}`);
  process.exit(1);
}

function optionValue(argv, index, name) {
  const arg = argv[index];
  const prefix = `${name}=`;
  if (arg.startsWith(prefix)) return { value: arg.slice(prefix.length), next: index };
  if (index + 1 >= argv.length) fail(`${name} 缺少参数值`);
  return { value: argv[index + 1], next: index + 1 };
}

function parseArgs(argv) {
  const options = {
    host: '127.0.0.1',
    port: 4173,
    dist: resolve(projectRoot, 'dist'),
    basePath: '/',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log('用法: node scripts/serve-dist.mjs [--dist <目录>] [--host <地址>] [--port <端口>] [--base-path <前缀>]');
      process.exit(0);
    }
    if (arg === '--dist' || arg.startsWith('--dist=')) {
      const parsed = optionValue(argv, index, '--dist');
      options.dist = resolve(parsed.value);
      index = parsed.next;
    } else if (arg === '--host' || arg.startsWith('--host=')) {
      const parsed = optionValue(argv, index, '--host');
      options.host = parsed.value;
      index = parsed.next;
    } else if (arg === '--port' || arg.startsWith('--port=')) {
      const parsed = optionValue(argv, index, '--port');
      const port = Number(parsed.value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`端口不合法: ${parsed.value}`);
      options.port = port;
      index = parsed.next;
    } else if (arg === '--base-path' || arg.startsWith('--base-path=')) {
      const parsed = optionValue(argv, index, '--base-path');
      if (!parsed.value.startsWith('/')) fail('--base-path 必须以 / 开头');
      if (/[?#]/.test(parsed.value)) fail('--base-path 不能包含查询串或 hash');
      const trimmed = parsed.value.replace(/\/+$/, '');
      options.basePath = trimmed === '' ? '/' : trimmed;
      index = parsed.next;
    } else {
      fail(`未知参数: ${arg}`);
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const distDir = resolve(options.dist);
const basePath = options.basePath;

function sendText(response, status, text, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(text);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
}

/** 把请求路径映射到 dist 内；任何越界路径都返回 null。 */
function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const candidate = resolve(distDir, `.${decoded}`);
  if (candidate !== distDir && !candidate.startsWith(`${distDir}${sep}`)) return null;
  return candidate;
}

async function serveFile(request, response, filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) return false;

  const extension = extname(filePath).toLowerCase();
  const immutable = filePath.startsWith(resolve(distDir, 'assets') + sep);
  response.writeHead(200, {
    'Content-Type': MIME_TYPES.get(extension) ?? 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (request.method === 'HEAD') {
    response.end();
    return true;
  }

  await new Promise((resolveStream) => {
    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!response.headersSent) sendText(response, 500, '读取文件失败');
      else response.destroy();
      resolveStream();
    });
    stream.on('end', resolveStream);
    stream.pipe(response);
  });
  return true;
}

async function handle(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, '只支持 GET / HEAD', { Allow: 'GET, HEAD' });
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname;
  } catch {
    sendText(response, 400, '请求地址不合法');
    return;
  }

  if (basePath !== '/') {
    if (pathname === '/' || pathname === basePath) {
      redirect(response, `${basePath}/`);
      return;
    }
    if (!pathname.startsWith(`${basePath}/`)) {
      sendText(response, 404, `这个演示站点部署在 ${basePath}/ 下。`);
      return;
    }
    pathname = pathname.slice(basePath.length) || '/';
  }

  if (pathname.endsWith('/')) pathname += 'index.html';

  const filePath = resolveFile(pathname);
  if (!filePath) {
    sendText(response, 403, '拒绝访问');
    return;
  }

  try {
    if (await serveFile(request, response, filePath)) return;

    // 静态页面只使用 hash 路由；无扩展名路径回退到 index.html，
    // 方便直接打开 /atlas/ 或误输入一个前端路径时仍能回到应用。
    if (!extname(filePath)) {
      if (await serveFile(request, response, resolve(distDir, 'index.html'))) return;
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      sendText(response, 404, '没有找到这个文件');
      return;
    }
    console.error('[demo] 请求处理失败', error);
    if (!response.headersSent) sendText(response, 500, '服务器内部错误');
    else response.destroy();
    return;
  }

  sendText(response, 404, '没有找到这个文件');
}

try {
  await stat(resolve(distDir, 'index.html'));
} catch {
  fail(`没有找到 ${resolve(distDir, 'index.html')}，请先运行 npm run build。`);
}

const server = createServer((request, response) => {
  void handle(request, response);
});

server.on('error', (error) => {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    fail(`端口 ${options.port} 已被占用，请换一个 --port。`);
  }
  fail(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
});

server.listen(options.port, options.host, () => {
  const suffix = basePath === '/' ? '/' : `${basePath}/`;
  console.log(`[demo] 静态目录: ${distDir}`);
  console.log(`[demo] 本地地址: http://${options.host}:${options.port}${suffix}`);
  console.log('[demo] 按 Ctrl+C 停止。');
});
