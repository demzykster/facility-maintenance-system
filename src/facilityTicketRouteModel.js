const clean = (value) => String(value == null ? "" : value).trim();

export function isFacilityTicket(ticket = {}) {
  return (ticket.track || (ticket.forkliftId ? "transport" : "facility")) === "facility";
}

export function facilityOwnerPatch(ticket = {}, session = {}, {
  supplier = ticket.supplier || "",
  status = ticket.status || "new"
} = {}) {
  const ownerName = clean(session.name) || clean(ticket.assignee);
  const supplierName = clean(supplier);
  if (supplierName) {
    return {
      supplier: supplierName,
      assignee: "",
      routedTech: true,
      mgrExec: false,
      status: status === "in_progress" ? "new" : (status || "new")
    };
  }
  const ownerIsDepartmentManager = session.role === "user";
  return {
    supplier: "",
    assignee: ownerName,
    routedTech: false,
    mgrExec: ownerIsDepartmentManager ? !!ownerName : false,
    status: status === "in_progress" ? "new" : (status || "new")
  };
}

export function normalizeFacilitySupplierPatch(ticket = {}, patch = {}, session = {}) {
  if (!isFacilityTicket(ticket) || !Object.prototype.hasOwnProperty.call(patch, "supplier")) return patch;
  return {
    ...patch,
    ...facilityOwnerPatch(ticket, session, {
      supplier: patch.supplier,
      status: patch.status || ticket.status || "new"
    })
  };
}
