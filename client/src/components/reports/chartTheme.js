// Shared look + helpers for the report charts.
//
// COLOURS: each chart series uses  var(--rpt-N, <default>).  Nothing defines --rpt-1..8 yet, so the
// defaults below apply (colour-blind friendly, first one matches --primary). To restyle the charts,
// define --rpt-1 ... --rpt-8 in styles/tokens.css. No chart code needs to change.
const DEFAULTS = ['#2563eb', '#d97706', '#15803d', '#7c3aed', '#be185d', '#0f766e', '#64748b', '#a16207']
export const color = (i) => `var(--rpt-${(i % 8) + 1}, ${DEFAULTS[i % 8]})`

export const axisTick = { fill: 'var(--muted-foreground, #475569)', fontSize: 12 }
export const gridStroke = 'var(--border, #cbd5e1)'
export const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover, #fff)',
    color: 'var(--popover-foreground, #0f172a)',
    border: '1px solid var(--border, #cbd5e1)',
    borderRadius: 8,
  },
}

// 'YYYY-MM-DD' (first of a month) -> 'Dec 21'
export const monthLabel = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })

// 'YYYY-MM-DD' (first of a quarter) -> 'Q4 21'
export const quarterLabel = (d) => {
  const dt = new Date(`${d}T00:00:00Z`)
  return `Q${Math.floor(dt.getUTCMonth() / 3) + 1} ${String(dt.getUTCFullYear()).slice(2)}`
}

// Tidy rows -> one object per `indexKey`, with one property per distinct `seriesKey` value.
//   pivot(rows, 'month', 'mealName', 'chosen') -> [{ month, 'Lentil...': 12, 'Aloo...': 9 }, ...]
// Returns { data, series } where series lists the distinct series names in order of first appearance.
export function pivot(rows, indexKey, seriesKey, valueKey) {
  const series = []
  const byIndex = new Map()
  for (const r of rows) {
    if (!series.includes(r[seriesKey])) series.push(r[seriesKey])
    const row = byIndex.get(r[indexKey]) ?? { [indexKey]: r[indexKey] }
    row[r[seriesKey]] = r[valueKey]
    byIndex.set(r[indexKey], row)
  }
  return { data: [...byIndex.values()], series }
}
