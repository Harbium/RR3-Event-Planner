import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, monthLabel, pivot, tooltipStyle } from './chartTheme'
import { getDietary } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Share of registrations carrying each dietary requirement, by month.
// Props: top = how many of the most common requirements to draw (default 5); from, to.
export default function DietaryTrendChart({ top = 5, from, to }) {
  const { data, loading, error } = useFetch(() => getDietary({ from, to }), [from, to])

  const rows = data?.monthly ?? []
  const totals = {}
  for (const r of rows) totals[r.name] = (totals[r.name] ?? 0) + r.registered
  const keep = new Set(Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, top).map(([name]) => name))
  const { data: chartData, series } = pivot(rows.filter((r) => keep.has(r.name)), 'month', 'name', 'share')

  return (
    <ChartCard
      title="Dietary requirements over time"
      description={`Share of registrations with each of the ${top} most common requirements`}
      summary="Monthly share of registrations for the most common dietary requirements"
      loading={loading} error={error} empty={!loading && chartData.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} minTickGap={24} />
          <YAxis tick={axisTick} width={48} tickFormatter={(v) => `${v}%`} />
          <Tooltip labelFormatter={monthLabel} formatter={(v) => `${v}%`} {...tooltipStyle} />
          <Legend />
          {series.map((name, i) => (
            <Line key={name} dataKey={name} stroke={color(i)} strokeWidth={2} dot={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
