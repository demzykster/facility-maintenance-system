import { describe, expect, it } from "vitest";
import { ticketServerCreateV2DependencyReady, ticketServerCreateV2Enabled, ticketServerCreateV2Status } from "../src/ticketServerCreateCutoverModel.js";

describe("ticket server create cutover model", () => {
  it("keeps server-create v2 disabled by default and supports scoped rollout values", () => {
    expect(ticketServerCreateV2Enabled({})).toBe(false);
    expect(ticketServerCreateV2Enabled({ CMMS_TICKET_SERVER_CREATE_V2: "false" })).toBe(false);
    expect(ticketServerCreateV2Enabled({ CMMS_TICKET_SERVER_CREATE_V2: "local", CMMS_APP_MODE: "production" })).toBe(false);
    expect(ticketServerCreateV2Enabled({ CMMS_TICKET_SERVER_CREATE_V2: "local", CMMS_APP_MODE: "local" })).toBe(true);
    expect(ticketServerCreateV2Enabled({ CMMS_TICKET_SERVER_CREATE_V2: "staging", CMMS_APP_MODE: "staging" })).toBe(true);
    expect(ticketServerCreateV2Enabled({ CMMS_TICKET_SERVER_CREATE_V2: "production", CMMS_APP_MODE: "production" })).toBe(true);
  });

  it("keeps dependency readiness as a separate server-owned rollout latch", () => {
    expect(ticketServerCreateV2DependencyReady({})).toBe(false);
    expect(ticketServerCreateV2DependencyReady({ CMMS_TICKET_SERVER_CREATE_V2_READY: "false" })).toBe(false);
    expect(ticketServerCreateV2DependencyReady({ CMMS_TICKET_SERVER_CREATE_V2_READY: "local", CMMS_APP_MODE: "production" })).toBe(false);
    expect(ticketServerCreateV2DependencyReady({ CMMS_TICKET_SERVER_CREATE_V2_READY: "local", CMMS_APP_MODE: "local" })).toBe(true);
    expect(ticketServerCreateV2DependencyReady({ CMMS_TICKET_SERVER_CREATE_V2_READY: "staging", CMMS_APP_MODE: "staging" })).toBe(true);
  });

  it("reports configured, dependency, and ready states without probing the database", () => {
    expect(ticketServerCreateV2Status({ env: {}, driver: { create() {} } })).toEqual({
      configured: false,
      dependency: "disabled",
      ready: false,
      disabledReason: "ticket_server_create_v2_disabled"
    });
    expect(ticketServerCreateV2Status({ env: { CMMS_TICKET_SERVER_CREATE_V2: "true" }, driver: { create() {} } })).toEqual({
      configured: true,
      dependency: "unavailable",
      ready: false,
      disabledReason: "ticket_create_rpc_unavailable"
    });
    expect(ticketServerCreateV2Status({ env: { CMMS_TICKET_SERVER_CREATE_V2: "true", CMMS_TICKET_SERVER_CREATE_V2_READY: "true" }, driver: {} })).toEqual({
      configured: true,
      dependency: "unavailable",
      ready: false,
      disabledReason: "ticket_create_rpc_unavailable"
    });
    expect(ticketServerCreateV2Status({ env: { CMMS_TICKET_SERVER_CREATE_V2: "true", CMMS_TICKET_SERVER_CREATE_V2_READY: "true" }, driver: { create() {} } })).toEqual({
      configured: true,
      dependency: "configured",
      ready: true,
      disabledReason: ""
    });
  });
});
