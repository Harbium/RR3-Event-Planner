// Small HTTP helpers shared by every route.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

// Express 5 forwards errors from async handlers here automatically.
// 4xx errors (our own HttpError, or bad JSON from express.json) are safe to show to the client;
// anything else (e.g. a database error) is logged and answered with a generic 500.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status ?? err.statusCode;
  if (status && status >= 400 && status < 500) {
    const message = err instanceof HttpError ? err.message : 'Bad request';
    return res.status(status).json({ error: message });
  }
  console.error(`${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'Internal server error' });
}
