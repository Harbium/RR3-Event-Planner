import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

// Fail fast with a useful message instead of a confusing error on the first request.
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy server/.env.example to server/.env and fill it in.'
  );
}

// Server-side client: the secret key bypasses Row Level Security, so it must never reach the browser.
export const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
