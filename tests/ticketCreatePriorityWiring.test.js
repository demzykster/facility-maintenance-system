import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const ticketForm = source.slice(source.indexOf("function TicketForm("), source.indexOf("function AdminTicketQuickEdit("));

describe("ticket create priority wiring", () => {
  it("starts without a default priority and validates it before create", () => {
    expect(ticketForm).toContain('useState(prefill?.priority || "")');
    expect(ticketForm).toContain('if (!priority) return setErr("נא לבחור עדיפות")');
    expect(ticketForm).toContain("missingTicketCreateFields({ track, subject, description, category, priority, forkliftId, downtimeType })");
  });

  it("uses the selected priority for both facility and transport tickets", () => {
    expect(ticketForm).toContain("const pr = priority;");
    expect(ticketForm).not.toContain('track === "transport" ? dtOf(downtimeType, config).prio : priority');
    expect(ticketForm.match(/<span>עדיפות \*<\/span>/g)).toHaveLength(1);
  });
});
