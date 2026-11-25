import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'

// Wrapper every report chart uses: a card with a title and handles loading / error / empty states.
//   summary: one sentence describing what the chart shows, read out by screen readers.
export default function ChartCard({ title, description, loading, error, empty, summary, height = 320, children }) {
  let body
  if (loading) body = <p>Loading...</p>
  else if (error) body = <p role="alert">Could not load this chart: {error}</p>
  else if (empty) body = <p>No data to show yet.</p>
  else {
    body = (
      <div role="img" aria-label={summary ?? title} style={{ height }}>
        {children}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
