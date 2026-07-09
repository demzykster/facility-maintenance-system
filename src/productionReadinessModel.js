export const PRODUCTION_READINESS_LEVELS = {
  demo: "demo",
  stagingPilot: "staging_pilot",
  finalProduction: "final_production"
};

const hasNoErrors = (items = []) => Array.isArray(items) && items.length === 0;

export function productionReadinessSummary({
  appMode = "demo",
  configGate = {},
  schema = {},
  backupDrill = {},
  stagingGate = {},
  normalizedBusinessTables = false,
  serverSideBusinessPermissions = false
} = {}) {
  const checks = {
    productionConfig: configGate.ok === true && hasNoErrors(configGate.errors),
    supabaseSchema: schema.ok === true,
    backupRestoreDrill: backupDrill.ok === true,
    stagingGate: stagingGate.ok === true,
    normalizedBusinessTables: normalizedBusinessTables === true,
    serverSideBusinessPermissions: serverSideBusinessPermissions === true
  };

  const blockers = [];
  if (appMode !== "production") blockers.push("app_mode_not_production");
  if (!checks.productionConfig) blockers.push("production_config_gate_not_passed");
  if (!checks.supabaseSchema) blockers.push("supabase_schema_not_verified");
  if (!checks.backupRestoreDrill) blockers.push("backup_restore_drill_not_verified");
  if (!checks.stagingGate) blockers.push("staging_gate_not_passed");

  const finalProductionBlockers = [];
  if (!checks.normalizedBusinessTables) finalProductionBlockers.push("normalized_business_tables_not_complete");
  if (!checks.serverSideBusinessPermissions) finalProductionBlockers.push("server_side_business_permissions_not_complete");

  const stagingPilotReady = blockers.length === 0;
  const finalProductionReady = stagingPilotReady && finalProductionBlockers.length === 0;

  return {
    level: finalProductionReady
      ? PRODUCTION_READINESS_LEVELS.finalProduction
      : stagingPilotReady
        ? PRODUCTION_READINESS_LEVELS.stagingPilot
        : PRODUCTION_READINESS_LEVELS.demo,
    stagingPilotReady,
    finalProductionReady,
    checks,
    blockers,
    finalProductionBlockers
  };
}
