import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config/index.js';
import { sendError, sendJson } from './core/http.js';
import { ApiError } from './core/ApiError.js';
import { createApiRouter } from './routes/subscriptionRoutes.js';
import { createStaticHandler } from './middleware/staticFiles.js';
import { seed } from './repositories/subscriptionRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

const apiRouter = createApiRouter();
const serveStatic = createStaticHandler(PUBLIC_DIR);

seed();

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  try {
    // API routes take precedence over static assets.
    if (pathname.startsWith('/api/')) {
      const handled = await apiRouter.handle(req, res, pathname);
      if (!handled) throw ApiError.notFound(`No API route for ${pathname}`);
      return;
    }

    if (await serveStatic(req, res, pathname)) return;

    sendJson(res, 404, { success: false, message: 'Not found' });
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    sendError(res, error);
  }
});

server.listen(config.port, () => {
  console.log(`Subscription Tracker running at http://localhost:${config.port}`);
  console.log(`Reference date for renewal calculations: ${config.currentDate}`);
});
