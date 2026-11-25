import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { axisTick, color, gridStroke, quarterLabel, tooltipStyle } from './chartTheme'
import { getForecastAccuracy } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'

// Average attendance forecast error per quarter: recorded staff forecast vs a history-based model.
// Lower is better. (MAPE = mean absolute percentage error.)
export default function ForecastAccuracyChart() {
  const { data, loading, error } = useFetch(() => getForecastAccuracy(), [])
  const rows = (data?.items ?? []).filter((r) => r.events >= 5) // skip quarters with too few events to mean anything

  return (
    <ChartCard
      title="Forecast accuracy"
      description="Average % error of attendance forecasts by quarter (lower is better)"
      summary="Quarterly average error of staff forecasts and the history-based model"
      loading={loading} error={error} empty={!loading && rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="quarter" tickFormatter={quarterLabel} tick={axisTick} minTickGap={16} />
          <YAxis tick={axisTick} width={48} tickFormatter={(v) => `${v}%`} />
          <Tooltip labelFormatter={quarterLabel} formatter={(v) => `${v}%`} {...tooltipStyle} />
          <Legend />
          <Line dataKey="staffMape" name="Staff forecast" stroke={color(0)} strokeWidth={2} dot={{ r: 3 }} />
          <Line dataKey="modelMape" name="History-based model" stroke={color(1)} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
