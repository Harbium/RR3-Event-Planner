import { api } from './client.js'

// Report data changes slowly and several charts on one page often want the same endpoint, so
// identical requests made within 30 seconds share one network call.
const cache = new Map()
const TTL = 30_000

function cached(path) {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL) return hit.promise
  const promise = api(path).catch((err) => {
    cache.delete(path)
    throw err
  })
  cache.set(path, { at: Date.now(), promise })
  return promise
}

const qs = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  return q.size ? `?${q}` : ''
}

// { summary, byLocation: [], dietary: [] }
export const getReportOverview = () => cached('/reports/overview')

// { items: [event + dietary: { requirement: count }], total }   (not cached: it is paged)
export const getReportEvents = ({ when = 'past', limit = 50, offset = 0 } = {}, options) =>
  api(`/reports/events?${new URLSearchParams({ when, limit, offset })}`, options)

// Time series. Optional { from, to } as 'YYYY-MM-DD' limit the months returned.
export const getMonthly = (range = {}) => cached(`/reports/monthly${qs(range)}`) // { items }
export const getMeals = (range = {}) => cached(`/reports/meals${qs(range)}`) // { items } tidy rows
export const getDietary = (range = {}) => cached(`/reports/dietary${qs(range)}`) // { monthly, byVenue }

// Comparisons
export const getVenues = () => cached('/reports/venues') // { items }
export const getForecastAccuracy = () => cached('/reports/forecast-accuracy') // { items }

// Expected attendance, meals and dietary needs for the next events: { method, modelError, items }
export const getUpcomingForecast = ({ limit = 10 } = {}) => cached(`/reports/forecast/upcoming${qs({ limit })}`)
