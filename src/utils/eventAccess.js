// The server summary contains only events where this session may validate tickets.
export function eventAdminRole(user, event, summary = [], section) {
 if (!event || user.role === 'admin' || user.role === 'checkin') return user.role
 const ownsOrganization = !!user.organizerId && user.organizerId === event.organizerId
 if (ownsOrganization && (user.role === 'organizador' || (user.role === 'financeiro' && section !== 'checkin'))) return user.role
 const assigned = summary.some(item => String(item.event_id) === String(event.id))
 return assigned ? 'checkin' : user.role
}
