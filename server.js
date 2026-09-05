import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAiRequest, HttpError, sendJson, publicError } from './server/ai-service.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'data');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};
const PUBLIC_DIRS = new Set(['css', 'js', 'data', 'assets', 'images', 'audio', 'fonts']);
const PUBLIC_FILES = new Set(['index.html', 'favicon.ico', 'robots.txt', 'manifest.json']);

function loadLocalEnvironment() {
  if (process.env.TOEIC_SKIP_ENV === '1') return;
  try {
    const contents = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      const value = match[2];
      process.env[match[1]] = /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value.replace(/\s+#.*$/, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Không đọc được cấu hình .env. Kiểm tra quyền đọc tệp.');
  }
}

// Check before URL normalization, which would otherwise erase dot segments.
export function decodePath(raw) {
  let decoded;
  try { decoded = decodeURIComponent(raw); }
  catch { throw new HttpError(400, 'INVALID_PATH', 'URL không hợp lệ.'); }
  if (/[\\\x00-\x1f:]/.test(decoded) || decoded.includes('%') || decoded.split('/').some(p => p.startsWith('.'))) {
    throw new HttpError(403, 'FORBIDDEN_PATH', 'Đường dẫn không được phép.');
  }
  return decoded;
}

function inside(base, target) {
  const relative = path.relative(base, target);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

async function resolvePublicFile(base, relative) {
  const target = path.resolve(base, relative);
  if (!inside(base, target)) throw new HttpError(403, 'FORBIDDEN_PATH', 'Đường dẫn không được phép.');
  let actual;
  try { actual = await fs.promises.realpath(target); }
  catch { throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy tệp.'); }
  const actualBase = await fs.promises.realpath(base);
  if (!inside(actualBase, actual)) throw new HttpError(403, 'FORBIDDEN_PATH', 'Đường dẫn không được phép.');
  if (base === ROOT) {
    const publicRelative = path.relative(actualBase, actual).split(path.sep).join('/');
    if (!isPublicPath(publicRelative)) throw new HttpError(403, 'FORBIDDEN_PATH', 'Tệp không công khai.');
  }
  const stat = await fs.promises.stat(actual);
  if (!stat.isFile()) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy tệp.');
  return { actual, stat };
}

function isPublicPath(relative) {
  const segments = relative.split('/');
  return !segments.some(p => !p || p.startsWith('.')) &&
    (PUBLIC_FILES.has(relative) || (PUBLIC_DIRS.has(segments[0]) && Object.hasOwn(MIME, path.extname(relative).toLowerCase())));
}

async function serveFile(req, res, file) {
  const { actual, stat } = file;
  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match && (match[1] || match[2])) {
      if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
      else start = Number(match[1]);
      if (match[1] && match[2]) end = Math.min(end, Number(match[2]));
    }
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size });
      res.end();
      return;
    }
    status = 206;
    res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + stat.size);
  }
  res.writeHead(status, {
    'Content-Type': MIME[path.extname(actual).toLowerCase()] || 'text/plain; charset=utf-8',
    'Content-Length': Math.max(0, end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'
  });
  if (req.method === 'HEAD' || stat.size === 0) { res.end(); return; }
  const stream = fs.createReadStream(actual, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

export function createAppServer(options = {}) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    try {
      const rawPath = (req.url || '/').split('?')[0];
      const pathname = decodePath(rawPath);
      const parsed = new URL(req.url, 'http://localhost');
      if (pathname === '/api/ai-generate') {
        await handleAiRequest(req, res, options);
        return;
      }
      if (pathname === '/api/data/save') throw new HttpError(405, 'LOCAL_STORAGE_ONLY', 'Lưu trong Quản lý nội dung; dùng Xuất JSON để cập nhật ngân hàng tệp.');
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD');
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.');
      }
      if (pathname === '/api/data') {
        const relative = parsed.searchParams.get('path') || parsed.searchParams.get('file');
        if (relative) {
          const decoded = decodePath(relative);
          if (decoded.startsWith('/') || path.extname(decoded) !== '.json') throw new HttpError(403, 'FORBIDDEN_PATH', 'Chỉ cho phép đọc JSON trong data.');
          await serveFile(req, res, await resolvePublicFile(DATA, decoded));
          return;
        }
        const manifest = {};
        for (const category of await fs.promises.readdir(DATA, { withFileTypes: true })) {
          if (category.isDirectory() && !category.name.startsWith('.')) {
            manifest[category.name] = (await fs.promises.readdir(path.join(DATA, category.name), { withFileTypes: true }))
              .filter(file => file.isFile() && file.name.endsWith('.json') && !file.name.startsWith('.')).map(file => file.name).sort();
          }
        }
        sendJson(res, 200, { success: true, manifest });
        return;
      }
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      if (!isPublicPath(relative)) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy tệp công khai.');
      await serveFile(req, res, await resolvePublicFile(ROOT, relative));
    } catch (error) {
      if (!res.headersSent) { const result = publicError(error); sendJson(res, result.status, result.body); }
      else res.destroy();
    }
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 15000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnvironment();
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT phải là số nguyên từ 0 đến 65535.');
  const host = process.env.HOST || '127.0.0.1';
  const server = createAppServer();
  server.listen(port, host, () => console.log('TOEIC Master: http://' + host + ':' + server.address().port));
  server.on('error', error => { console.error('Không khởi động được server (' + (error.code || 'UNKNOWN') + ').'); process.exitCode = 1; });
}
