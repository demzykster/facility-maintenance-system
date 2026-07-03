export function supplierActivityCounts({ supplier, orders = [], fleet = [], contacts = [] } = {}) {
  const name = String(supplier || "").trim();
  if (!name) return { orders: 0, fleet: 0, contacts: 0, linked: 0 };

  const orderCount = (orders || []).filter((order) => order?.supplier === name).length;
  const fleetCount = (fleet || []).filter((unit) => unit?.supplier === name).length;
  const contactCount = (contacts || []).length;

  return {
    orders: orderCount,
    fleet: fleetCount,
    contacts: contactCount,
    linked: orderCount + fleetCount
  };
}
