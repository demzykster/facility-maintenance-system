export function hasSavedVehicleTypeCatalog(config) {
  return Array.isArray(config?.vehicleTypes) && config.vehicleTypes.length > 0;
}

export function cloneVehicleTypeCatalog(vehicleTypes = []) {
  return vehicleTypes.map((vehicleType) => ({
    ...vehicleType,
    models: [...(vehicleType.models || [])]
  }));
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
