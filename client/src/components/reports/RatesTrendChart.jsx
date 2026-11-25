import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, monthLabel, tooltipStyle } from './chartTheme'
import { getMonthly } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Fill rate (registered / capacity) and show rate (attended / registered) per month.
export default function RatesTrendChart({ from, to }) {
  const { data, loading, error } = useFetch(() => getMonthly({ from, to }), [from, to])
  const rows = data?.items ?? []

  return (
    <ChartCard
      title="Fill rate and show rate"
      description="How full events get, and how many registered people actually turn up"
      summary="Monthly fill rate and show rate as percentages"
      loading={loading} error={error} empty={!loading && rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} minTickGap={24} />
          <YAxis tick={axisTick} width={48} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip labelFormatter={monthLabel} formatter={(v) => `${v}%`} {...tooltipStyle} />
          <Legend />
          <Line dataKey="fillRate" name="Fill rate" stroke={color(0)} strokeWidth={2} dot={false} />
          <Line dataKey="showRate" name="Show rate" stroke={color(1)} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
