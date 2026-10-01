import { createContext, useContext, useMemo, useState } from 'react'
import { defaultEvents } from '../data/defaultEvents'

const EventContext = createContext(null)
const EVENTS_KEY = 'ingressos_events_v1'
const ORDERS_KEY = 'ingressos_orders_v1'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function EventProvider({ children }) {
  const [events, setEvents] = useState(() => readJson(EVENTS_KEY, defaultEvents))
  const [orders, setOrders] = useState(() => readJson(ORDERS_KEY, []))

  function persistEvents(next) {
    setEvents(next)
    localStorage.setItem(EVENTS_KEY, JSON.stringify(next))
  }

  function persistOrders(next) {
    setOrders(next)
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next))
  }

  function saveEvent(event) {
    const existing = events.some((e) => e.id === event.id)
    const next = existing ? events.map((e) => (e.id === event.id ? event : e)) : [event, ...events]
    persistEvents(next)
  }

  function deleteEvent(id) {
    persistEvents(events.filter((e) => e.id !== id))
  }

  function resetEvents() {
    persistEvents(defaultEvents)
  }

  function addOrder(order) {
    persistOrders([order, ...orders])
  }

  function markTicketUsed(code) {
    let found = false
    let alreadyUsed = false
    const next = orders.map((order) => {
      const codes = (order.ticketCodes || []).map((ticket) => {
        if (ticket.code !== code) return ticket
        found = true
        if (ticket.used) {
          alreadyUsed = true
          return ticket
        }
        return { ...ticket, used: true, usedAt: new Date().toISOString() }
      })
      return { ...order, ticketCodes: codes }
    })
    if (found && !alreadyUsed) persistOrders(next)
    return { found, alreadyUsed }
  }

  const value = useMemo(() => ({ events, orders, saveEvent, deleteEvent, resetEvents, addOrder, markTicketUsed }), [events, orders])
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

export function useEventStore() {
  const ctx = useContext(EventContext)
  if (!ctx) throw new Error('useEventStore precisa estar dentro de EventProvider')
  return ctx
}
