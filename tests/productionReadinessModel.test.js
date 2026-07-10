import { describe, expect, it } from "vitest";
import { PRODUCTION_READINESS_LEVELS, productionReadinessSummary } from "../src/productionReadinessModel.js";

const passedStagingInputs = {
  appMode: "production",
  configGate: { ok: true, errors: [] },
  schema: { ok: true },
  backupDrill: { ok: true },
  stagingGate: { ok: true }
};

describe("productionReadinessModel", () => {
  it("keeps default local/demo state below staging pilot readiness", () => {
    expect(productionReadinessSummary()).toMatchObject({
      level: PRODUCTION_READINESS_LEVELS.demo,
      stagingPilotReady: false,
      finalProductionReady: false,
      blockers: [
        "app_mode_not_production",
        "production_config_gate_not_passed",
        "supabase_schema_not_verified",
        "backup_restore_drill_not_verified",
        "staging_gate_not_passed"
      ]
    });
  });

  it("stays at staging pilot when final-production data-core flags are not supplied", () => {
    expect(productionReadinessSummary(passedStagingInputs)).toMatchObject({
      level: PRODUCTION_READINESS_LEVELS.stagingPilot,
      stagingPilotReady: true,
      finalProductionReady: false,
      blockers: [],
      finalProductionBlockers: [
        "normalized_business_tables_not_complete",
        "server_side_business_permissions_not_complete"
      ]
    });
  });

  it("requires normalized business tables and server-side business permissions for final production", () => {
    expect(productionReadinessSummary({
      ...passedStagingInputs,
      normalizedBusinessTables: true,
      serverSideBusinessPermissions: true
    })).toMatchObject({
      level: PRODUCTION_READINESS_LEVELS.finalProduction,
      stagingPilotReady: true,
      finalProductionReady: true,
      blockers: [],
      finalProductionBlockers: []
    });
  });
});
