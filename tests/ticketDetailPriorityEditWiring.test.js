import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(new URL("../src/TicketDetail.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("ticket detail priority edit wiring", () => {
  it("opens the dedicated priority editor from the priority/risk display", () => {
    expect(detailSource).toContain('const canEditPriority = isAdmin && track === "facility";');
    expect(detailSource).toContain('onClick={() => setAdminQuickEdit("priority")}');
    expect(detailSource).toContain('label="רמת סיכון"');
    expect(detailSource).toContain('canEditPriority ? () => setAdminQuickEdit("priority") : null');
  });

  it("does not expose generic priority editing for transport ticket details", () => {
    expect(detailSource).toContain('{track === "facility" && (canEditPriority ? <button');
    expect(detailSource).not.toContain('action={isAdmin ? () => setAdminQuickEdit("priority") : null}');
  });

  it("opens a transport downtime editor instead of generic priority values", () => {
    expect(detailSource).toContain('track === "transport" && isAdmin ? () => setAdminQuickEdit("downtimeType")');
    expect(detailSource).toContain('downtimeType: "עריכת מצב הכלי"');
    expect(detailSource).toContain('field === "downtimeType"');
    expect(detailSource).toContain("dtLevels(config)");
    expect(detailSource).toContain("updateTicketDowntime(ticket.id, patch.downtimeType)");
  });

  it("saves priority through the dedicated updater instead of the generic ticket save", () => {
    expect(detailSource).toContain("const adminPrioritySave");
    expect(detailSource).toContain("updateTicketPriority(ticket.id, patch.priority)");
    expect(detailSource).toContain('onSave={adminQuickEdit === "priority" ? adminPrioritySave');
    expect(appSource).toContain("const updateTicketPriority = async (ticketId, priority)");
    expect(appSource).toContain("NORMALIZED_TICKET_PROVIDER.updatePriority(ticketId, priority)");
  });

  it("saves transport downtime through the dedicated updater instead of generic ticket save", () => {
    expect(detailSource).toContain("const adminDowntimeSave");
    expect(detailSource).toContain("updateTicketDowntime(ticket.id, patch.downtimeType)");
    expect(detailSource).toContain('adminQuickEdit === "downtimeType" ? adminDowntimeSave');
    expect(appSource).toContain("const updateTicketDowntime = async (ticketId, downtimeType)");
    expect(appSource).toContain("NORMALIZED_TICKET_PROVIDER.updateDowntime(ticketId, downtimeType)");
  });
});
