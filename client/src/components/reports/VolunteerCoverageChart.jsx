import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, monthLabel, tooltipStyle } from './chartTheme'
import { getMonthly } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Volunteer slots needed vs filled each month, and the % of events that were short-staffed.
export default function VolunteerCoverageChart({ from, to }) {
  const { data, loading, error } = useFetch(() => getMonthly({ from, to }), [from, to])
  const rows = data?.items ?? []

  return (
    <ChartCard
      title="Volunteer coverage"
      description="Volunteer slots needed and filled each month, and the share of events with too few volunteers"
      summary="Monthly volunteers needed, volunteers booked and percentage of understaffed events"
      loading={loading} error={error} empty={!loading && rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} minTickGap={24} />
          <YAxis yAxisId="people" tick={axisTick} width={48} />
          <YAxis yAxisId="rate" orientation="right" tick={axisTick} width={48} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip labelFormatter={monthLabel} {...tooltipStyle} />
          <Legend />
          <Bar yAxisId="people" dataKey="volunteersNeeded" name="Needed" fill={color(0)} />
          <Bar yAxisId="people" dataKey="volunteersBooked" name="Booked" fill={color(2)} />
          <Line yAxisId="rate" dataKey="understaffedRate" name="Events short-staffed (%)" stroke={color(1)} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
