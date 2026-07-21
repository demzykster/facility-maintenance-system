export async function deleteTicketAndClose({ ticketId, deleteTicket, onBack } = {}) {
  if (!ticketId || typeof deleteTicket !== "function") return false;
  const deleted = await deleteTicket(ticketId);
  if (deleted === false) return false;
  if (typeof onBack === "function") onBack();
  return true;
}
