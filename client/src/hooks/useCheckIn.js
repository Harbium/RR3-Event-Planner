import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCheckIn, setAttendance, addWalkIn as apiAddWalkIn } from '../api/events.js'

const without = (obj, key) => {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

/**
 * Live data and actions for a check-in screen. Build the screen; this hook does the hard part.
 * Full guide: docs/CHECKIN.md
 *
 *   const { event, menu, attendees, counts, setAttended, addWalkIn, ... } = useCheckIn(eventId)
 *
 * What it does for you
 *  - Loads the screen's data and keeps it fresh by asking the server every `pollMs` (default 4s),
 *    but only while the tab is visible, and straight away when the tab comes back or the network returns.
 *  - Ticking someone updates the screen instantly, then saves. If the save fails the tick is undone and an
 *    entry appears in `saveErrors` so the screen can say so and offer a retry.
 *  - A refresh that was already on its way can never undo a change you just made (no flicker).
 *  - `counts` are worked out from the same list you render, so numbers and list always agree.
 *
 * Returns
 *   event            the event (name, capacity, ...) or null until loaded
 *   menu             [{ id, name, stock, chosen, remaining, satisfies: [dietaryRequirementId] }]
 *   attendees        [{ id, name, dietary, meal, attended, walkIn, checkedInAt, registeredAt }], by name
 *   counts           { registered, attended, notArrived, walkIns, overCapacity }
 *   loading          true only until the first response
 *   error            message if the very first load failed (nothing to show yet)
 *   connectionLost   true if refreshing is failing but we still have data on screen ("last updated ..." is stale)
 *   lastUpdated      Date of the last good response from the server
 *   saving           { [attendeeId]: boolean }   saves in flight (disable that row's button)
 *   saveErrors       { [attendeeId]: { message, wanted } }   failed saves; retry with setAttended(id, wanted)
 *   setAttended(id, attended)  -> Promise<boolean>   true if saved
 *   addWalkIn(body)            -> Promise<{ attendee, registered, capacity, overCapacity }>
 *                                 rejects with the server's plain message (e.g. "That meal has run out...")
 *   refresh()        ask the server now
 */
export function useCheckIn(eventId, { pollMs = 4000 } = {}) {
  const [snapshot, setSnapshot] = useState(null) // last good response from the server
  const [error, setError] = useState(null)
  const [connectionLost, setConnectionLost] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [saving, setSaving] = useState({}) // { [attendeeId]: the value being saved }
  const [saveErrors, setSaveErrors] = useState({})

  const version = useRef(0) // bumped on every local change, so a poll that started earlier is ignored
  const busy = useRef(new Set()) // attendee ids with a save in flight
  const polling = useRef(false)
  const hasData = useRef(false)
  const controller = useRef(null)

  const refresh = useCallback(async () => {
    const mine = controller.current // identifies this screen/mount (React dev mode mounts twice)
    if (!eventId || !mine || polling.current) return
    polling.current = true
    const startedAt = version.current
    try {
      const fresh = await getCheckIn(eventId, { signal: mine.signal })
      if (mine !== controller.current) return // belongs to an earlier mount: ignore
      if (version.current !== startedAt) return // we changed something while waiting; the next refresh catches up
      hasData.current = true
      setSnapshot(fresh)
      setLastUpdated(new Date(fresh.serverTime))
      setConnectionLost(false)
      setError(null)
    } catch (err) {
      if (err.name === 'AbortError' || mine !== controller.current) return
      if (hasData.current) setConnectionLost(true)
      else setError(err.message)
    } finally {
      if (mine === controller.current) polling.current = false
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) return
    controller.current = new AbortController()
    hasData.current = false
    polling.current = false
    busy.current.clear()
    version.current++
    setSnapshot(null)
    setError(null)
    setConnectionLost(false)
    setSaving({})
    setSaveErrors({})

    const tick = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    const timer = setInterval(tick, pollMs)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('online', tick)
    return () => {
      controller.current.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('online', tick)
    }
  }, [eventId, pollMs, refresh])

  const setAttended = useCallback(
    async (attendeeId, attended) => {
      if (busy.current.has(attendeeId)) return false // already saving this person
      busy.current.add(attendeeId)
      version.current++
      setSaveErrors((e) => without(e, attendeeId))
      setSaving((s) => ({ ...s, [attendeeId]: attended }))
      try {
        const res = await setAttendance(eventId, attendeeId, attended)
        version.current++
        setSnapshot(
          (prev) =>
            prev && {
              ...prev,
              attendees: prev.attendees.map((a) =>
                a.id === attendeeId ? { ...a, attended, checkedInAt: res.checkedInAt } : a
              ),
            }
        )
        return true
      } catch (err) {
        // A save that "failed" (e.g. a timeout) may still have gone through; the next refresh shows the truth.
        setSaveErrors((e) => ({ ...e, [attendeeId]: { message: err.message || 'Could not save', wanted: attended } }))
        return false
      } finally {
        busy.current.delete(attendeeId)
        setSaving((s) => without(s, attendeeId))
      }
    },
    [eventId]
  )

  const addWalkIn = useCallback(
    async (body) => {
      const result = await apiAddWalkIn(eventId, body) // throws with the server's plain message
      version.current++
      // show them straight away; the refresh below then confirms everything with the server
      setSnapshot((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          attendees: [...prev.attendees, result.attendee].sort((a, b) => a.name.localeCompare(b.name)),
          menu: prev.menu.map((m) =>
            m.id === body.mealId ? { ...m, chosen: m.chosen + 1, remaining: Math.max(0, m.remaining - 1) } : m
          ),
        }
      })
      refresh()
      return result
    },
    [eventId, refresh]
  )

  const attendees = useMemo(
    () => (snapshot?.attendees ?? []).map((a) => (a.id in saving ? { ...a, attended: saving[a.id] } : a)),
    [snapshot, saving]
  )

  const counts = useMemo(() => {
    const attended = attendees.filter((a) => a.attended).length
    return {
      registered: attendees.length,
      attended,
      notArrived: attendees.length - attended,
      walkIns: attendees.filter((a) => a.walkIn).length,
      overCapacity: snapshot?.event ? attendees.length > snapshot.event.capacity : false,
    }
  }, [attendees, snapshot])

  return {
    event: snapshot?.event ?? null,
    menu: snapshot?.menu ?? [],
    attendees,
    counts,
    loading: snapshot === null && error === null, // true until the first response (or the first error)
    error,
    connectionLost,
    lastUpdated,
    saving: useMemo(() => Object.fromEntries(Object.keys(saving).map((id) => [id, true])), [saving]),
    saveErrors,
    setAttended,
    addWalkIn,
    refresh,
  }
}
