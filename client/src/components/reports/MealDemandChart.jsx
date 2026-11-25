import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, monthLabel, pivot, tooltipStyle } from './chartTheme'
import { getMeals } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Which meals people choose, as a share of each month's choices. Lines make seasonal swings easy to see.
export default function MealDemandChart({ from, to }) {
  const { data, loading, error } = useFetch(() => getMeals({ from, to }), [from, to])

  // turn counts into % of that month's total
  const rows = data?.items ?? []
  const totals = {}
  for (const r of rows) totals[r.month] = (totals[r.month] ?? 0) + r.chosen
  const shares = rows.map((r) => ({ ...r, share: totals[r.month] ? Math.round((1000 * r.chosen) / totals[r.month]) / 10 : 0 }))
  const { data: chartData, series } = pivot(shares, 'month', 'mealName', 'share')

  return (
    <ChartCard
      title="Meal demand"
      description="Share of each month's meal choices by meal"
      summary="Monthly share of meal choices for each meal"
      loading={loading} error={error} empty={!loading && chartData.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} minTickGap={24} />
          <YAxis tick={axisTick} width={48} domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
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
