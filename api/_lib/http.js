export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;   // Vercel already parsed it
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new HttpError(413, 'Request body too large.');
  }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw new HttpError(400, 'Request body must be JSON.'); }
}

// Wraps a { GET, POST, ... } map into one handler with consistent errors.
export function route(methods) {
  return async (req, res) => {
    const handler = methods[req.method];
    if (!handler) {
      res.setHeader('Allow', Object.keys(methods).join(', '));
      return send(res, 405, { error: 'Method not allowed.' });
    }
    try {
      const body = await handler(req, res);
      if (!res.writableEnded) send(res, 200, body);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error('[api]', err);
      send(res, status, { error: err.message || 'Server error.', ...(err.extra || {}) });
    }
  };
}
