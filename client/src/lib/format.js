// The database stores real timestamps (UTC with offset). Always show them in UK time,
// whatever the viewer's computer is set to, so a 12:30 lunch reads 12:30 in summer and winter.
const TZ = 'Europe/London'

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ,
  })

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })

export const formatDateTime = (iso) => `${formatDate(iso)}, ${formatTime(iso)}`

export const percent = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '-')
