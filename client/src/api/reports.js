import { api } from './client.js'

// { summary, byLocation: [], dietary: [] }
export const getReportOverview = (options) => api('/reports/overview', options)

// { items: [event + dietary: { requirement: count }], total }
export const getReportEvents = ({ when = 'past', limit = 50, offset = 0 } = {}, options) =>
  api(`/reports/events?${new URLSearchParams({ when, limit, offset })}`, options)
