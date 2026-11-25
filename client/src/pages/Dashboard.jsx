import ReportsSummary from '../components/reports/ReportsSummary.jsx'
import EventsList from '../components/EventsList.jsx'
import { fetchEvents } from '../api/events.js'
import { useFetch } from '../hooks/useFetch.js'

const NEXT_EVENTS = 5

// The dashboard is a stack of sections, top to bottom. To add one, put a new <section> (or a component)
// inside <main>. Each section loads its own data, so sections do not depend on each other.
export default function Dashboard() {
  const { data, loading, error } = useFetch(
    (opts) => fetchEvents({ when: 'upcoming', limit: NEXT_EVENTS }, opts),
    []
  )

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-4">
      <h1>Dashboard</h1>

      <ReportsSummary />

      <section aria-labelledby="next-events-heading">
        <h2 id="next-events-heading">Next events</h2>
        {loading && <p>Loading events...</p>}
        {error && <p role="alert">Could not load events: {error}</p>}
        {data && <EventsList events={data.items} />}
      </section>
    </main>
  )
}
