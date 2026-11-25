import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, monthLabel, tooltipStyle } from './chartTheme'
import { getMeals } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Meals prepared but not eaten, and meals booked but not eaten (no-shows), as % of prepared, per month.
export default function MealWasteChart({ from, to }) {
  const { data, loading, error } = useFetch(() => getMeals({ from, to }), [from, to])

  const byMonth = {}
  for (const r of data?.items ?? []) {
    const m = (byMonth[r.month] ??= { month: r.month, chosen: 0, eaten: 0, stock: 0 })
    m.chosen += r.chosen; m.eaten += r.eaten; m.stock += r.stock
  }
  const rows = Object.values(byMonth)
    .filter((m) => m.stock > 0)
    .map((m) => ({
      month: m.month,
      uneaten: Math.round((1000 * (m.stock - m.eaten)) / m.stock) / 10, // prepared but not eaten
      spare: Math.round((1000 * (m.stock - m.chosen)) / m.stock) / 10, // prepared but nobody booked
    }))

  return (
    <ChartCard
      title="Meal waste"
      description="Portions prepared that were not eaten, and portions nobody booked, as % of portions prepared"
      summary="Monthly percentage of prepared meals that were not eaten"
      loading={loading} error={error} empty={!loading && rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} minTickGap={24} />
          <YAxis tick={axisTick} width={48} tickFormatter={(v) => `${v}%`} />
          <Tooltip labelFormatter={monthLabel} formatter={(v) => `${v}%`} {...tooltipStyle} />
          <Legend />
          <Line dataKey="uneaten" name="Prepared, not eaten" stroke={color(1)} strokeWidth={2} dot={false} />
          <Line dataKey="spare" name="Prepared, not booked" stroke={color(0)} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
