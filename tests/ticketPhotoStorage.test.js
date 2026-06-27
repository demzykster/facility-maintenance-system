import { describe, expect, it, vi } from "vitest";
import { createTicketPhotoStorage, ticketPhotoPath } from "../src/ticketPhotoStorage.js";

describe("ticketPhotoStorage", () => {
  it("stores production ticket photos in the file api and returns a metadata path", async () => {
    const apiProvider = {
      upload: vi.fn().mockResolvedValue(true),
      download: vi.fn().mockResolvedValue({ contentType: "image/png", data: "abc" }),
      delete: vi.fn().mockResolvedValue(true)
    };
    const storage = createTicketPhotoStorage({
      appMode: "production",
      provider: "api",
      apiBaseUrl: "https://cmms.example/api",
      apiProvider
    });

    await expect(storage.save("T-1", "before", "data:image/png;base64,abc")).resolves.toEqual({
      hasPhoto: true,
      photoPath: "tickets/T-1/before.png"
    });
    await expect(storage.load({ id: "T-1", hasPhoto: true, photoPath: "tickets/T-1/before.png" }, "before")).resolves.toBe("data:image/png;base64,abc");

    expect(apiProvider.upload).toHaveBeenCalledWith("tickets/T-1/before.png", {
      data: "data:image/png;base64,abc",
      contentType: "image/png"
    });
  });

  it("keeps demo/local ticket photos in legacy storage keys", async () => {
    const appStore = {
      set: vi.fn().mockResolvedValue(true),
      get: vi.fn().mockResolvedValue("data:image/jpeg;base64,abc")
    };
    const storage = createTicketPhotoStorage({ appMode: "demo", provider: "local", appStore });

    await expect(storage.save("T-1", "after", "data:image/jpeg;base64,abc")).resolves.toEqual({
      hasAfterPhoto: true
    });
    await expect(storage.load({ id: "T-1", hasAfterPhoto: true }, "after")).resolves.toBe("data:image/jpeg;base64,abc");

    expect(appStore.set).toHaveBeenCalledWith("photo:after:T-1", "data:image/jpeg;base64,abc", true);
    expect(appStore.get).toHaveBeenCalledWith("photo:after:T-1", true);
  });

  it("falls back to legacy reads when a production file download fails", async () => {
    const apiProvider = {
      download: vi.fn().mockRejectedValue(new Error("offline"))
    };
    const appStore = {
      get: vi.fn().mockResolvedValue("data:image/jpeg;base64,legacy")
    };
    const storage = createTicketPhotoStorage({
      appMode: "production",
      provider: "api",
      apiBaseUrl: "https://cmms.example/api",
      apiProvider,
      appStore
    });

    await expect(storage.load({ id: "T-1", hasPhoto: true, photoPath: "tickets/T-1/before.jpg" }, "before")).resolves.toBe("data:image/jpeg;base64,legacy");

    expect(apiProvider.download).toHaveBeenCalledWith("tickets/T-1/before.jpg");
    expect(appStore.get).toHaveBeenCalledWith("photo:T-1", true);
  });

  it("builds stable paths by photo kind and image content type", () => {
    expect(ticketPhotoPath("T-1", "before", "data:image/webp;base64,abc")).toBe("tickets/T-1/before.webp");
    expect(ticketPhotoPath("T-1", "after", "data:image/jpeg;base64,abc")).toBe("tickets/T-1/after.jpg");
  });
});
