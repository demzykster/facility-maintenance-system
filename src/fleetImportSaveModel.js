export const FLEET_IMPORT_BATCH_SIZE = 25;

export const chunkFleetImportUnits = (units = [], size = FLEET_IMPORT_BATCH_SIZE) => {
  const chunkSize = Math.max(1, Number(size) || FLEET_IMPORT_BATCH_SIZE);
  const list = (units || []).filter((unit) => unit?.id);
  const chunks = [];
  for (let i = 0; i < list.length; i += chunkSize) chunks.push(list.slice(i, i + chunkSize));
  return chunks;
};

export async function saveFleetImportAtomically({
  units = [],
  catalogAdditions = [],
  saveMany = null,
  saveOne = null,
  saveCatalog = null,
  rollbackOne = null,
  batchSize = FLEET_IMPORT_BATCH_SIZE,
  onProgress = null
} = {}) {
  const list = (units || []).filter((unit) => unit?.id);
  const savedIds = [];
  const report = () => {
    if (typeof onProgress === "function") onProgress({ saved: savedIds.length, total: list.length });
  };

  try {
    report();
    if (!list.length) {
      if ((catalogAdditions || []).length && typeof saveCatalog === "function") {
        const catalogOk = await saveCatalog();
        if (catalogOk === false) throw new Error("catalog_save_failed");
      }
      return { ok: true, savedIds };
    }

    for (const chunk of chunkFleetImportUnits(list, batchSize)) {
      if (typeof saveMany === "function") {
        const ok = await saveMany(chunk);
        if (ok === false) throw new Error("fleet_import_save_failed");
        savedIds.push(...chunk.map((unit) => unit.id));
        report();
      } else if (typeof saveOne === "function") {
        for (const unit of chunk) {
          const saved = await saveOne(unit);
          if (saved === false) throw new Error("fleet_import_save_failed");
          savedIds.push(unit.id);
          report();
        }
      } else {
        throw new Error("fleet_import_save_missing");
      }
    }

    if (typeof saveCatalog === "function") {
      const catalogOk = await saveCatalog();
      if (catalogOk === false) throw new Error("catalog_save_failed");
    }

    return { ok: true, savedIds };
  } catch (error) {
    if (typeof rollbackOne === "function") {
      for (const id of [...savedIds].reverse()) {
        try { await rollbackOne(id); } catch {}
      }
    }
    return { ok: false, savedIds, rolledBackIds: [...savedIds].reverse(), error: error?.message || "fleet_import_failed" };
  }
}
