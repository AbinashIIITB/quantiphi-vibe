import { ApiError } from './ApiError.js';

/**
 * Minimal HTTP router with `:param` path segments.
 *
 * Kept dependency-free on purpose: the whole project runs on Node's built-in
 * modules, so a reviewer can clone and `node server/server.js` with no install
 * step. Routes are registered as (method, pattern, handler) and matched by
 * splitting both the pattern and the request path on "/".
 */
export class Router {
  constructor() {
    /** @type {{method: string, segments: string[], handler: Function}[]} */
    this.routes = [];
  }

  register(method, pattern, handler) {
    this.routes.push({
      method: method.toUpperCase(),
      segments: splitPath(pattern),
      handler,
    });
    return this;
  }

  get(pattern, handler) {
    return this.register('GET', pattern, handler);
  }

  post(pattern, handler) {
    return this.register('POST', pattern, handler);
  }

  patch(pattern, handler) {
    return this.register('PATCH', pattern, handler);
  }

  delete(pattern, handler) {
    return this.register('DELETE', pattern, handler);
  }

  /**
   * Finds a route matching the request and invokes its handler.
   *
   * @returns {Promise<boolean>} true if a route handled the request.
   */
  async handle(req, res, pathname) {
    const requestSegments = splitPath(pathname);
    let pathMatchedButMethodDidNot = false;

    for (const route of this.routes) {
      const params = matchSegments(route.segments, requestSegments);
      if (!params) continue;

      if (route.method !== req.method) {
        pathMatchedButMethodDidNot = true;
        continue;
      }

      req.params = params;
      await route.handler(req, res);
      return true;
    }

    if (pathMatchedButMethodDidNot) {
      throw new ApiError(405, `Method ${req.method} not allowed for ${pathname}`);
    }
    return false;
  }
}

function splitPath(path) {
  return path.split('/').filter(Boolean);
}

/**
 * Compares a route pattern against a request path.
 *
 * @returns {Record<string, string> | null} extracted params, or null if no match.
 */
function matchSegments(patternSegments, requestSegments) {
  if (patternSegments.length !== requestSegments.length) return null;

  const params = {};
  for (let i = 0; i < patternSegments.length; i += 1) {
    const pattern = patternSegments[i];
    const actual = requestSegments[i];

    if (pattern.startsWith(':')) {
      params[pattern.slice(1)] = decodeURIComponent(actual);
    } else if (pattern !== actual) {
      return null;
    }
  }
  return params;
}
