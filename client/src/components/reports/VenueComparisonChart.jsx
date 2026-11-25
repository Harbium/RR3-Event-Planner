import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, tooltipStyle } from './chartTheme'
import { getVenues } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Fill rate and show rate for every venue (busiest venues first).
export default function VenueComparisonChart() {
  const { data, loading, error } = useFetch(() => getVenues(), [])
  const rows = data?.items ?? []

  return (
    <ChartCard
      title="Venue comparison"
      description="Fill rate (registered / capacity) and show rate (attended / registered), busiest venues first"
      summary="Fill rate and show rate for each venue"
      loading={loading} error={error} empty={!loading && rows.length === 0}
      height={Math.max(320, rows.length * 44)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={axisTick} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={axisTick} width={170} />
          <Tooltip formatter={(v) => `${v}%`} {...tooltipStyle} />
          <Legend />
          <Bar dataKey="fillRate" name="Fill rate" fill={color(0)} />
          <Bar dataKey="showRate" name="Show rate" fill={color(1)} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
