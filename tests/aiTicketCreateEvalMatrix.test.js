import { describe, expect, it } from "vitest";

const scenarios = [
  ["simple_ru_fan_226", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract", "create_ticket"], ["get_open_tickets_for_asset"], false, true, "created"],
  ["again_brakes_226", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract", "get_open_tickets_for_asset"], ["create_ticket"], true, false, "blocked"],
  ["vehicle_wont_move_226", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract"], ["create_ticket"], true, false, "blocked"],
  ["machine_problem_no_number", ["get_current_user_context", "find_asset_by_visible_identifier"], ["create_ticket"], true, false, "blocked"],
  ["machine_999_missing", ["get_current_user_context", "find_asset_by_visible_identifier"], ["create_ticket"], true, false, "blocked"],
  ["identifier_multiple_assets", ["get_current_user_context", "find_asset_by_visible_identifier"], ["create_ticket"], true, false, "blocked"],
  ["identifier_typo", ["get_current_user_context", "find_asset_by_visible_identifier"], ["create_ticket"], true, false, "blocked"],
  ["current_asset_context_no_number", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract", "create_ticket"], ["get_open_tickets_for_asset"], false, true, "created"],
  ["similar_open_ticket_simple_issue", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract", "create_ticket"], ["get_open_tickets_for_asset"], false, true, "created"],
  ["smoke_226", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract"], ["create_ticket"], true, false, "blocked"],
  ["sparks_226", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract"], ["create_ticket"], true, false, "blocked"],
  ["brake_failure_226", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract"], ["create_ticket"], true, false, "blocked"],
  ["no_ticket_permission", ["get_current_user_context"], ["create_ticket"], false, false, "permission_denied"],
  ["ru_text_hebrew_fields", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract", "create_ticket"], ["get_open_tickets_for_asset"], false, true, "created"],
  ["same_idempotency_key_replay", ["create_ticket"], [], false, false, "replayed"],
  ["same_key_different_payload_conflict", ["create_ticket"], [], false, false, "failed"],
  ["lost_response_after_persisted_create", ["create_ticket"], [], false, false, "replayed"],
  ["capability_create_error", ["create_ticket"], [], false, false, "failed"],
  ["simple_no_extra_reads", ["get_current_user_context", "find_asset_by_visible_identifier", "get_ticket_create_contract", "create_ticket"], ["get_open_tickets_for_asset", "get_asset_summary"], false, true, "created"],
  ["no_question_for_non_form_location", ["get_ticket_create_contract"], ["ask_location"], false, true, "created"],
  ["no_diagnosis_fabrication", ["create_ticket"], ["diagnose_motor", "diagnose_belt"], false, true, "created"],
  ["concurrent_creates_distinct_numbers", ["cmms_create_ticket", "ticket_num_transport_seq"], ["browser_max_num"], false, true, "created"],
  ["facility_transport_separate_sequences", ["ticket_num_facility_seq", "ticket_num_transport_seq"], ["counter_table"], false, true, "created"],
  ["existing_update_no_new_number", ["tickets_get", "tickets_upsert"], ["nextval"], false, true, "updated"],
  ["generic_upsert_update_no_sequence", ["tickets_get", "tickets_upsert"], ["nextval"], false, true, "updated"],
  ["empty_namespace_starts_one", ["setval_false"], ["setval_greatest_true"], false, false, "migration_static"],
  ["existing_namespace_max_plus_one", ["setval_max_true"], ["setval_greatest_true"], false, false, "migration_static"],
  ["preflight_duplicate_namespace_num", ["ticket_number_duplicate_preflight_failed"], ["auto_renumber"], false, false, "migration_blocked"],
  ["rpc_closed_to_browser_roles", ["revoke_public_anon_authenticated", "grant_service_role"], ["grant_authenticated"], false, false, "migration_static"],
  ["feature_flag_disabled_old_behavior", ["provider_path"], ["create_ticket"], false, false, "feature_disabled"]
].map(([id, expectedCalls, forbiddenCalls, blockingQuestion, writes, expectedStatus]) => ({
  id,
  expectedCalls,
  forbiddenCalls,
  blockingQuestion,
  writes,
  expectedStatus
}));

describe("AI ticket.create eval matrix", () => {
  it("documents the required first-slice scenarios and prohibited calls", () => {
    expect(scenarios).toHaveLength(30);
    for (const scenario of scenarios) {
      expect(scenario.id).toMatch(/^[a-z0-9_]+$/);
      expect(scenario.expectedCalls.length).toBeGreaterThan(0);
      expect(new Set(scenario.expectedCalls)).not.toContain("arbitrary_sql");
      expect(scenario.forbiddenCalls).not.toContain("service_role_to_ai");
      expect(["created", "replayed", "blocked", "permission_denied", "failed", "feature_disabled", "updated", "migration_static", "migration_blocked"]).toContain(scenario.expectedStatus);
    }
  });

  it("keeps simple create cheap and recurrence/dangerous cases conservative", () => {
    const byId = Object.fromEntries(scenarios.map((scenario) => [scenario.id, scenario]));
    expect(byId.simple_ru_fan_226.forbiddenCalls).toContain("get_open_tickets_for_asset");
    expect(byId.simple_ru_fan_226.blockingQuestion).toBe(false);
    expect(byId.again_brakes_226.expectedCalls).toContain("get_open_tickets_for_asset");
    expect(byId.again_brakes_226.forbiddenCalls).toContain("create_ticket");
    expect(byId.vehicle_wont_move_226.expectedStatus).toBe("blocked");
    expect(byId.feature_flag_disabled_old_behavior.forbiddenCalls).toContain("create_ticket");
  });
});
