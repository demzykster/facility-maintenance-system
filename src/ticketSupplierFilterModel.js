const SUPPLIER_TYPE_IDS = new Set(["facility", "transport", "goods"]);
export const SUPPLIER_TYPE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "facility", label: "אחזקת מבנה", short: "מבנה" }),
  Object.freeze({ id: "transport", label: "אחזקת כלי שינוע", short: "שינוע" }),
  Object.freeze({ id: "goods", label: "ספק ציוד", short: "ציוד" })
]);

const supplierTypeDefinition = (type) => SUPPLIER_TYPE_DEFINITIONS.find((item) => item.id === type);

export const supplierFacilityScope = (id) => `facility:${id}`;

export const supplierMeta = (config = {}, name = "") => config?.supplierMeta?.[name] || {};

export const supplierFacilityScopeOptions = (config = {}) => (config?.categories || [])
  .map((category) => ({ id: supplierFacilityScope(category.id), label: category.label, group: "facility" }));

export const supplierTypeLabel = (type) => supplierTypeDefinition(type)?.label || "ללא סוג";

export const supplierTypeShort = (type) => supplierTypeDefinition(type)?.short || "ללא סוג";

export function supplierIndustryLabel(id, config = {}) {
  const option = supplierFacilityScopeOptions(config).find((item) => item.id === id);
  if (option) return `מבנה · ${option.label}`;
  return id === "facility" ? "מבנה ותחזוקה" : id;
}

export function supplierScopesFromMeta(industries = [], config = {}) {
  const raw = Array.isArray(industries) ? industries : [];
  const scopes = new Set(raw.filter((id) => id && !["facility", "transport", "clothing", "goods"].includes(id)));
  if (raw.includes("facility")) {
    (config?.categories || []).forEach((category) => scopes.add(supplierFacilityScope(category.id)));
  }
  return [...scopes];
}

export function supplierTypeFromMeta(meta = {}, config = {}) {
  if (SUPPLIER_TYPE_IDS.has(meta.type)) return meta.type;
  const raw = Array.isArray(meta.industries) ? meta.industries : [];
  const scopes = supplierScopesFromMeta(raw, config);
  if (raw.includes("transport")) return "transport";
  if (raw.includes("clothing") || raw.includes("goods")) return "goods";
  if (raw.includes("facility") || scopes.some((id) => id.startsWith("facility:"))) return "facility";
  return "";
}

export const supplierHasTransportScope = (config, name) =>
  supplierTypeFromMeta(supplierMeta(config, name), config) === "transport";

export const supplierHasPpeScope = (config, name) =>
  supplierTypeFromMeta(supplierMeta(config, name), config) === "goods";

export function supplierHasFacilityCategory(config, name, category) {
  const meta = supplierMeta(config, name);
  if (supplierTypeFromMeta(meta, config) !== "facility") return false;
  const scopes = supplierScopesFromMeta(meta.industries, config).filter((id) => id.startsWith("facility:"));
  return scopes.length === 0 || (!!category && scopes.includes(supplierFacilityScope(category)));
}

export function supplierCandidatesForTicket(config = {}, ticket = {}, fleet = []) {
  const names = Array.isArray(config?.suppliers) ? config.suppliers : [];
  const track = ticket?.track || (ticket?.forkliftId ? "transport" : "facility");
  const linkedUnit = track === "transport" && ticket?.forkliftId
    ? (fleet || []).find((unit) => unit?.id === ticket.forkliftId)
    : null;
  const linkedSupplier = linkedUnit?.supplier || "";

  const candidates = names.filter((name) => {
    if (track === "transport") return name === linkedSupplier || supplierHasTransportScope(config, name);
    return supplierHasFacilityCategory(config, name, ticket?.category);
  });
  if (!linkedSupplier) return candidates;
  return [linkedSupplier, ...candidates.filter((name) => name !== linkedSupplier)];
}
