import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card'
import AttendanceTrendChart from './AttendanceTrendChart'
import { getReportOverview } from '../../api/reports.js'
import { useFetch } from '../../hooks/useFetch.js'
import { percent } from '../../lib/format.js'

// 'YYYY-MM-01' for the first day of the month, one year ago
function twelveMonthsAgo() {
  const d = new Date()
  return `${d.getUTCFullYear() - 1}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// Compact reports block for the dashboard: headline numbers, one chart of the last 12 months,
// and a link to the full reports page. To show every report here instead, render <Reports /> from
// components/Reports.jsx (or pick other charts from components/reports/).
export default function ReportsSummary() {
  const { data, loading, error } = useFetch(getReportOverview)
  const [from] = useState(twelveMonthsAgo)

  const s = data?.summary
  const stats = s && [
    { label: 'Events held', value: s.pastEvents },
    { label: 'Upcoming events', value: s.upcomingEvents },
    { label: 'Show rate', value: percent(s.pastAttended, s.pastRegistered) },
    { label: 'Volunteer slots filled', value: percent(s.pastVolunteersBooked, s.pastVolunteersNeeded) },
  ]

  return (
    <section aria-labelledby="reports-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="reports-heading">Reports</h2>
        <Button variant="outline" nativeButton={false} render={<Link to="/reports" />}>All reports</Button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p role="alert">Could not load reports: {error}</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle style={{ fontSize: 'var(--text-stat)' }}>{stat.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <AttendanceTrendChart from={from} />
    </section>
  )
}
