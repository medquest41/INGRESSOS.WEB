// Only the optional contact column may fall back. Permissions, network failures,
// missing core tables and other schema errors must remain visible.
export async function withOptionalOrganizerContact(query) {
  const response = await query(true)
  const error = response.error
  const missingContact = error && ['42703', 'PGRST204'].includes(error.code) &&
    /whatsapp/i.test(error.message || '') &&
    /does not exist|could not find|schema cache/i.test(error.message || '')
  return missingContact ? query(false) : response
}
