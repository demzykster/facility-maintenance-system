export const bulkFleetDocumentLabels = {
  insurance: "ביטוח",
  tasrir: "תסקיר",
  license: "רישיון רכב",
  lease: "סיום ליזינג"
};

const normalizeSelection = (selectedIds = []) => new Set((selectedIds || []).filter(Boolean));

export function selectedFleetUnits(rows = [], selectedIds = []) {
  const selected = normalizeSelection(selectedIds);
  return (rows || []).filter((unit) => unit?.id && selected.has(unit.id));
}

export function applyFleetBulkDepartment(units = [], department, now = Date.now()) {
  const dept = String(department || "").trim();
  if (!dept) return [];
  return (units || []).filter((unit) => unit?.id).map((unit) => ({
    ...unit,
    dept,
    depts: [dept],
    updatedAt: now
  }));
}

export function applyFleetBulkDocumentDate(units = [], docId, date, now = Date.now()) {
  const id = String(docId || "").trim();
  const value = String(date || "").trim();
  if (!id || !value) return [];
  return (units || []).filter((unit) => unit?.id).map((unit) => ({
    ...unit,
    docs: {
      ...(unit.docs || {}),
      [id]: {
        ...(unit.docs?.[id] || {}),
        date: value
      }
    },
    updatedAt: now
  }));
}
