import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, monthLabel, tooltipStyle } from './chartTheme'
import { getMonthly } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Registered vs attended people per month, with the number of events held (which explains most month-to-month swings).
// Props: from, to ('YYYY-MM-DD') to limit the months shown.
export default function AttendanceTrendChart({ from, to }) {
  const { data, loading, error } = useFetch(() => getMonthly({ from, to }), [from, to])
  const rows = data?.items ?? []

  return (
    <ChartCard
      title="Attendance over time"
      description="People registered and people who attended each month, and how many events were held"
      summary="Monthly registrations, attendance and number of events held"
      loading={loading} error={error} empty={!loading && rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} minTickGap={24} />
          <YAxis yAxisId="people" tick={axisTick} width={48} />
          <YAxis yAxisId="events" orientation="right" tick={axisTick} width={32} allowDecimals={false} />
          <Tooltip labelFormatter={monthLabel} {...tooltipStyle} />
          <Legend />
          <Bar yAxisId="people" dataKey="registered" name="Registered" fill={color(0)} />
          <Bar yAxisId="people" dataKey="attended" name="Attended" fill={color(2)} />
          <Line yAxisId="events" dataKey="events" name="Events held" stroke={color(1)} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
