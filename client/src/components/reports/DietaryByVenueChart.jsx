import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, pivot, tooltipStyle } from './chartTheme'
import { getDietary } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// How dietary needs differ between venues: share of each venue's registrations.
// Props: requirements = names to compare (must match the dietary_requirements table).
export default function DietaryByVenueChart({ requirements = ['Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten free'] }) {
  const { data, loading, error } = useFetch(() => getDietary(), [])

  const rows = (data?.byVenue ?? []).filter((r) => requirements.includes(r.name))
  const { data: chartData } = pivot(rows, 'venue', 'name', 'share')

  return (
    <ChartCard
      title="Dietary needs by venue"
      description="Share of each venue's registrations with each requirement"
      summary="Dietary requirement shares compared across venues"
      loading={loading} error={error} empty={!loading && chartData.length === 0}
      height={Math.max(360, chartData.length * 64)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={axisTick} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="venue" tick={axisTick} width={170} />
          <Tooltip formatter={(v) => `${v}%`} {...tooltipStyle} />
          <Legend />
          {requirements.map((name, i) => <Bar key={name} dataKey={name} fill={color(i)} />)}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
