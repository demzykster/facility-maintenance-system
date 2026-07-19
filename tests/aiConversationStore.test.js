import { describe, expect, it, vi } from "vitest";
import { createSupabaseAiConversationStore } from "../server/agent/conversations/conversationStore.js";

function okJson(value) {
  return {
    ok: true,
    async text() {
      return JSON.stringify(value);
    }
  };
}

describe("AI conversation Supabase store", () => {
  it("reads and archives only active owned conversations", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(okJson([]))
      .mockResolvedValueOnce(okJson([]));
    const store = createSupabaseAiConversationStore({
      url: "https://supabase.example",
      serviceRoleKey: "service-role",
      fetchImpl
    });

    await store.getMine({ id: "conv-1", ownerUserId: "u1" });
    await store.archiveMine({ id: "conv-1", ownerUserId: "u1", at: 1000 });

    expect(fetchImpl.mock.calls[0][0]).toContain("id=eq.conv-1");
    expect(fetchImpl.mock.calls[0][0]).toContain("owner_user_id=eq.u1");
    expect(fetchImpl.mock.calls[0][0]).toContain("status=eq.active");
    expect(fetchImpl.mock.calls[1][0]).toContain("id=eq.conv-1");
    expect(fetchImpl.mock.calls[1][0]).toContain("owner_user_id=eq.u1");
    expect(fetchImpl.mock.calls[1][0]).toContain("status=eq.active");
  });
});
