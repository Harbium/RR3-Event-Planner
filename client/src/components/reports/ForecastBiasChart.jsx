import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, tooltipStyle } from './chartTheme'
import { getVenues } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Do staff over- or under-predict attendance at each venue? Bars to the right = over-predict.
export default function ForecastBiasChart() {
  const { data, loading, error } = useFetch(() => getVenues(), [])
  const rows = (data?.items ?? []).filter((v) => v.staffBias != null)

  return (
    <ChartCard
      title="Forecast bias by venue"
      description="Average % difference between predicted and actual attendance. Right = staff over-predict, left = under-predict"
      summary="Staff forecast bias for each venue"
      loading={loading} error={error} empty={!loading && rows.length === 0}
      height={Math.max(320, rows.length * 36)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={axisTick} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={axisTick} width={170} />
          <ReferenceLine x={0} stroke="var(--foreground, #0f172a)" />
          <Tooltip formatter={(v) => `${v > 0 ? '+' : ''}${v}%`} {...tooltipStyle} />
          <Bar dataKey="staffBias" name="Bias">
            {rows.map((v) => <Cell key={v.id} fill={v.staffBias > 0 ? color(1) : color(0)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
