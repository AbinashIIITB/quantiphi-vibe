import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/**
 * Serves files from a root directory.
 *
 * Requests for "/" resolve to index.html. Any resolved path that escapes the
 * root directory is rejected, which blocks "../" traversal attempts.
 *
 * @param {string} rootDir Absolute path of the directory to serve.
 * @returns {(req, res, pathname: string) => Promise<boolean>} true if served.
 */
export function createStaticHandler(rootDir) {
  return async function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;

    const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const absolutePath = path.resolve(rootDir, relativePath);

    // Reject anything that resolves outside the served root.
    if (!absolutePath.startsWith(path.resolve(rootDir))) return false;

    let stats;
    try {
      stats = await stat(absolutePath);
    } catch {
      return false;
    }
    if (!stats.isFile()) return false;

    const contentType = MIME_TYPES[path.extname(absolutePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });

    if (req.method === 'HEAD') {
      res.end();
      return true;
    }

    await new Promise((resolve, reject) => {
      const stream = createReadStream(absolutePath);
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res);
    });
    return true;
  };
}
