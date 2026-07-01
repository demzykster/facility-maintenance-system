export function hasSavedVehicleTypeCatalog(config) {
  return Array.isArray(config?.vehicleTypes) && (config.vehicleTypes.length > 0 || config.vehicleTypesSaved === true);
}

export function cloneVehicleTypeCatalog(vehicleTypes = []) {
  return vehicleTypes.map((vehicleType) => ({
    ...vehicleType,
    models: [...(vehicleType.models || [])]
  }));
}

export function vehicleTypeModelCodes(vehicleType) {
  const models = (vehicleType?.models || []).map((model) => String(model || "").trim()).filter(Boolean);
  const fallback = String(vehicleType?.name || "").trim();
  return models.length ? models : (fallback ? [fallback] : []);
}

export function vehicleTypeManagedDocs(vehicleType) {
  const docs = [];
  if (vehicleType?.insurance) docs.push("ביטוח");
  if (vehicleType?.tasrir) docs.push("תסקיר");
  if (vehicleType?.license) docs.push("רישיון רכב");
  if (vehicleType?.lease) docs.push("ליסינג");
  return docs;
}

export function vehicleTypeCompactSummary(vehicleType, fleet = []) {
  const explicitModels = (vehicleType?.models || []).map((model) => String(model || "").trim()).filter(Boolean);
  const affectedCodes = vehicleTypeInUseCodes(vehicleType, fleet);
  return {
    modelCount: explicitModels.length,
    affectedCount: affectedCodes.length,
    affectedCodes,
    managedDocs: vehicleTypeManagedDocs(vehicleType)
  };
}

export function vehicleTypeInUseCodes(vehicleType, fleet = []) {
  const models = new Set(vehicleTypeModelCodes(vehicleType));
  const targetName = String(vehicleType?.name || "").trim();
  const isModelOnlyRow = targetName && models.size === 1 && models.has(targetName);
  if (!models.size) return [];
  const codes = [];
  (fleet || []).forEach((unit) => {
    const explicitKind = String(unit?.vehicleKind || "").trim();
    const model = String(unit?.model || unit?.type || "").trim();
    if (explicitKind && targetName && explicitKind === targetName) {
      codes.push(String(unit?.code || model || explicitKind));
      return;
    }
    if (explicitKind && targetName && explicitKind !== targetName && !isModelOnlyRow) return;
    if (models.has(model)) codes.push(String(unit?.code || model));
  });
  return [...new Set(codes)];
}

export function catalogAwareTypeMaps(saved = {}, defaults = {}) {
  const hasStructuredCatalog = hasSavedVehicleTypeCatalog(saved);
  if (hasStructuredCatalog) {
    return {
      forkliftTypes: saved.forkliftTypes || [],
      typeSla: saved.typeSla || {},
      typeMeta: saved.typeMeta || {}
    };
  }

  return {
    forkliftTypes: saved.forkliftTypes || defaults.forkliftTypes || [],
    typeSla: { ...(defaults.typeSla || {}), ...(saved.typeSla || {}) },
    typeMeta: { ...(defaults.typeMeta || {}), ...(saved.typeMeta || {}) }
  };
}

export function vehicleTypeExistsInConfig(name, config = {}) {
  const value = String(name || "").trim();
  if (!value) return false;

  if (hasSavedVehicleTypeCatalog(config)) {
    return (config.vehicleTypes || []).some((vehicleType) => String(vehicleType?.name || "").trim() === value);
  }

  return (config.vehicleTypes || []).some((vehicleType) => String(vehicleType?.name || "").trim() === value) || !!config.typeMeta?.[value];
}

export function fleetUnitsMissingFromVehicleCatalog(fleet = [], vehicleTypes = []) {
  const typeNames = new Set();
  const modelCodes = new Set();

  (vehicleTypes || []).forEach((vehicleType) => {
    const typeName = String(vehicleType?.name || "").trim();
    if (typeName) typeNames.add(typeName);
    vehicleTypeModelCodes(vehicleType).forEach((model) => modelCodes.add(model));
  });

  const missing = [];
  (fleet || []).forEach((unit) => {
    const explicitKind = String(unit?.vehicleKind || "").trim();
    const model = String(unit?.model || (explicitKind ? "" : unit?.type) || "").trim();

    if (explicitKind) {
      if (!typeNames.has(explicitKind)) missing.push(unit);
      return;
    }

    if (model && !modelCodes.has(model)) missing.push(unit);
  });

  return missing;
}

export function shouldUseBuiltInVehicleCatalog({ productionStartsEmpty = false, hasSavedCatalog = false, fleetCount = 0 } = {}) {
  if (hasSavedCatalog) return true;
  if (fleetCount > 0) return true;
  return !productionStartsEmpty;
}

export function vehicleCatalogBase({ config, fleet = [], productionStartsEmpty = false, buildVehicleTypes }) {
  if (hasSavedVehicleTypeCatalog(config)) return cloneVehicleTypeCatalog(config.vehicleTypes);
  const useBuiltIn = shouldUseBuiltInVehicleCatalog({
    productionStartsEmpty,
    hasSavedCatalog: false,
    fleetCount: fleet.length
  });
  return useBuiltIn && typeof buildVehicleTypes === "function" ? buildVehicleTypes(config, fleet) : [];
}
