export function supplierActivityCounts({ supplier, orders = [], fleet = [], tickets = [], contacts = [] } = {}) {
  const name = String(supplier || "").trim();
  if (!name) return { orders: 0, fleet: 0, tickets: 0, contacts: 0, linked: 0 };

  const orderCount = (orders || []).filter((order) => order?.supplier === name).length;
  const fleetCount = (fleet || []).filter((unit) => unit?.supplier === name).length;
  const ticketCount = (tickets || []).filter((ticket) => ticket?.supplier === name || ticket?.closure?.costSupplier === name).length;
  const contactCount = (contacts || []).length;

  return {
    orders: orderCount,
    fleet: fleetCount,
    tickets: ticketCount,
    contacts: contactCount,
    linked: orderCount + fleetCount + ticketCount
  };
}
