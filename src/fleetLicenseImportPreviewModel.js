import { parseFleetLicenseWorkbook, planFleetLicenseCatalogAdditions } from "./fleetLicenseImportModel.js";

const pickRows = (rows = [], action) => (rows || [])
  .filter((row) => row?.action === action)
  .map((row) => ({
    sourceRow: row.sourceRow,
    action: row.action,
    chassis: row.unit?.chassis || "",
    supplier: row.unit?.supplier || "",
    model: row.unit?.model || "",
    vehicleKind: row.unit?.vehicleKind || "",
    conflictId: row.conflictId || "",
    invalid: row.invalid || [],
    warnings: row.warnings || []
  }));

export function buildFleetLicenseImportPreview(sheets = [], { existingFleet = [], config = {} } = {}) {
  const parsed = parseFleetLicenseWorkbook(sheets, { existingFleet });
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
      sheet: parsed.sheet || "רישיונות",
      missing: parsed.missing || [],
      summary: parsed.summary
    };
  }

  const catalogAdditions = planFleetLicenseCatalogAdditions(parsed.rows, config, { includeActions: ["new", "conflict"] });
  return {
    ok: true,
    sheet: parsed.sheet,
    headerRow: parsed.headerRow,
    summary: parsed.summary,
    catalogAdditions,
    newRows: pickRows(parsed.rows, "new"),
    conflicts: pickRows(parsed.rows, "conflict"),
    invalidRows: pickRows(parsed.rows, "invalid"),
    ignoredHeaders: parsed.ignoredHeaders || []
  };
}
