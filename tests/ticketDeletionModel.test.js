import { describe, expect, it, vi } from "vitest";
import {
  deleteTicketAndClose
} from "../src/ticketDeletionModel.js";

describe("ticket deletion model", () => {
  it("closes only after a successful facility deletion", async () => {
    const calls = [];
    const deleteTicket = vi.fn(async () => {
      calls.push("delete");
      return true;
    });
    const onBack = vi.fn(() => calls.push("back"));

    await expect(deleteTicketAndClose({ ticketId: "F-1", deleteTicket, onBack })).resolves.toBe(true);
    expect(calls).toEqual(["delete", "back"]);
  });

  it("keeps a transport ticket open when deletion fails", async () => {
    const onBack = vi.fn();

    await expect(deleteTicketAndClose({
      ticketId: "T-1",
      deleteTicket: vi.fn().mockResolvedValue(false),
      onBack
    })).resolves.toBe(false);
    expect(onBack).not.toHaveBeenCalled();
  });

});
