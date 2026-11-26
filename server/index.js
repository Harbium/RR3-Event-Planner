import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import eventsRouter from './routes/events.js';
import reportsRouter from './routes/reports.js';
import attendeesRouter from './routes/attendees.js';
import referenceRouter from './routes/reference.js';
import { notFound, errorHandler } from './lib/http.js';

const app = express();

// CORS: in development Vite proxies /api, so none is needed. In production set CLIENT_ORIGIN to the
// frontend's URL (comma-separate several). With it unset, cross-origin browser requests are refused.
const origins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/events', eventsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/attendees', attendeesRouter);
app.use('/api', referenceRouter);

// Anything else under /api is a JSON 404, and every error ends up in one place.
app.use('/api', notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API: http://localhost:${PORT}`));
