import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const ticketForm = source.slice(source.indexOf("function TicketForm("), source.indexOf("function AdminTicketQuickEdit("));

describe("ticket create priority wiring", () => {
  it("keeps facility priority explicit and derives transport priority from vehicle condition", () => {
    expect(ticketForm).toContain('useState(prefill?.priority || "")');
    expect(ticketForm).toContain('const transportPriority = track === "transport" ? transportPriorityForDowntimeType(downtimeType, config, DOWNTIME) : "";');
    expect(ticketForm).toContain('const effectivePriority = track === "transport" ? transportPriority : priority;');
    expect(ticketForm).toContain('if (track === "facility" && !priority) return setErr("נא לבחור עדיפות")');
    expect(ticketForm).toContain("missingTicketCreateFields({ track, subject, description, category, priority: effectivePriority, forkliftId, downtimeType })");
  });

  it("shows the generic priority selector only for facility tickets", () => {
    expect(ticketForm).toContain("const pr = effectivePriority;");
    expect(ticketForm).toContain('{track === "facility" && <div className="field"><span>עדיפות *</span>');
    expect(ticketForm.match(/<span>עדיפות \*<\/span>/g)).toHaveLength(1);
    expect(ticketForm).toContain("dtLevels(config).map");
  });
});
