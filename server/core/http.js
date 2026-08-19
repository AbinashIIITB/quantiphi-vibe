import { ApiError } from './ApiError.js';

const MAX_BODY_BYTES = 1_000_000; // 1 MB guard against unbounded request bodies.

/**
 * Reads and parses a JSON request body.
 * Returns an empty object for bodies that are absent (e.g. GET/DELETE).
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<object>}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(ApiError.badRequest('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(ApiError.badRequest('Request body is not valid JSON'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Sends a JSON response.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} payload
 */
export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * Translates any thrown error into a consistent JSON error envelope.
 * Unknown errors become a 500 and are logged rather than leaked to the client.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {unknown} error
 */
export function sendError(res, error) {
  if (error instanceof ApiError) {
    sendJson(res, error.statusCode, {
      success: false,
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {}),
    });
    return;
  }

  console.error('[unhandled]', error);
  sendJson(res, 500, {
    success: false,
    message: 'Internal server error',
  });
}
