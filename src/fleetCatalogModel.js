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
