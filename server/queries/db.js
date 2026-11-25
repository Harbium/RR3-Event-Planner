import { supabase } from '../supabase.js';

// Read every row of a view. Supabase returns at most 1000 rows per request, so this pages through
// them (orderBy must make the order stable). Optional filters: { column, from, to } on a date column.
export async function fetchAll(view, columns = '*', { orderBy = [], dateColumn, from, to } = {}) {
  const PAGE = 1000;
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase.from(view).select(columns).range(offset, offset + PAGE - 1);
    if (dateColumn && from) q = q.gte(dateColumn, from);
    if (dateColumn && to) q = q.lte(dateColumn, to);
    for (const col of [].concat(orderBy)) q = q.order(col, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}
