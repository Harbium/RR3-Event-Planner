import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartCard from './ChartCard'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { axisTick, color, gridStroke, tooltipStyle } from './chartTheme'
import { getUpcomingForecast } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'
import { formatDateTime } from '../../lib/format.js'

// Expected attendance, meals and dietary needs for the next events, with a detail view of one event.
// Props: limit = how many upcoming events to list (default 10).
export default function UpcomingForecast({ limit = 10 }) {
  const { data, loading, error } = useFetch(() => getUpcomingForecast({ limit }), [limit])
  const [selectedId, setSelectedId] = useState(null)

  if (loading) return <p>Loading forecast...</p>
  if (error) return <p role="alert">Could not load the forecast: {error}</p>
  if (data.items.length === 0) return <p>No upcoming events to forecast.</p>

  const selected = data.items.find((i) => i.event.id === selectedId) ?? data.items[0]
  const { event, forecast } = selected

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Upcoming events forecast</CardTitle>
          <CardDescription>
            Expected attendance from recent history (typically within about {data.modelError}% of the real figure).
            Registered shows people booked so far; expected is the full forecast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>When</th>
                <th>Registered so far</th>
                <th>Expected registered</th>
                <th>Expected attending</th>
                <th>Staff prediction</th>
                <th>Meals</th>
                <th><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(({ event: e, forecast: f }) => (
                <tr key={e.id} aria-selected={e.id === event.id}>
                  <td>{e.name}<br /><small>{e.location.name}</small></td>
                  <td>{formatDateTime(e.start)}</td>
                  <td>{e.registeredNow} / {e.capacity}</td>
                  <td>{f.registered}</td>
                  <td>{f.attended} ({f.attendedRange[0]}-{f.attendedRange[1]})</td>
                  <td>{e.staffPredicted}</td>
                  <td>
                    {!e.menuPlanned ? 'Menu not planned'
                      : f.meals.some((m) => m.shortfall) ? 'May run short' : 'Stock looks fine'}
                  </td>
                  <td>
                    <Button size="sm" variant={e.id === event.id ? 'default' : 'outline'} onClick={() => setSelectedId(e.id)}>
                      {e.id === event.id ? 'Shown' : 'Show'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <ChartCard
        title={`Meals: ${event.name}`}
        description={`${formatDateTime(event.start)} · ${event.location.name}${event.menuPlanned ? '' : ' · no menu yet, showing all meals'}`}
        summary="Expected number of people choosing each meal compared with the portions prepared"
        height={300}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={forecast.meals} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={axisTick} interval={0} />
            <YAxis tick={axisTick} width={40} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            <Bar dataKey="expectedChosen" name="Expected to book" fill={color(0)} />
            <Bar dataKey="expectedEaten" name="Expected to eat" fill={color(2)} />
            {event.menuPlanned && <Bar dataKey="stock" name="Portions prepared" fill={color(1)} />}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={`Dietary needs: ${event.name}`}
        description="Expected number of registered people with each requirement"
        summary="Expected number of people for each dietary requirement"
        height={Math.max(260, forecast.dietary.length * 36)}
        empty={forecast.dietary.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={forecast.dietary} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={axisTick} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={axisTick} width={110} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="expectedRegistered" name="Expected people" fill={color(3)} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}
