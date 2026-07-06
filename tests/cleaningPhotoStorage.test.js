import { describe, expect, it, vi } from "vitest";
import {
  cleaningComplaintIssuePhotoPath,
  cleaningComplaintPhotoPath,
  cleaningRoundIssuePhotoPath,
  createCleaningPhotoStorage
} from "../src/cleaningPhotoStorage.js";

describe("cleaningPhotoStorage", () => {
  it("stores production complaint photos in the file api and keeps only metadata on the record", async () => {
    const apiProvider = {
      upload: vi.fn().mockResolvedValue(true),
      download: vi.fn().mockResolvedValue({ contentType: "image/png", data: "abc" })
    };
    const storage = createCleaningPhotoStorage({
      appMode: "production",
      provider: "api",
      apiBaseUrl: "https://cmms.example/api",
      apiProvider
    });

    const stored = await storage.saveComplaint({
      id: "C-1",
      photo: "data:image/png;base64,abc",
      issues: [{ itemId: "sink", photo: "data:image/jpeg;base64,def", reason: "broken" }]
    });

    expect(stored).toEqual({
      id: "C-1",
      photo: null,
      photoPath: "cleaning/complaints/C-1/photo.png",
      hasPhoto: true,
      issues: [{ itemId: "sink", photo: null, photoPath: "cleaning/complaints/C-1/issues/sink.jpg", hasPhoto: true, reason: "broken" }]
    });
    expect(apiProvider.upload).toHaveBeenCalledWith("cleaning/complaints/C-1/photo.png", {
      data: "data:image/png;base64,abc",
      contentType: "image/png",
      metadata: expect.objectContaining({
        ownerType: "cleaning_complaint",
        ownerId: "C-1",
        kind: "cleaning_complaint_photo",
        path: "cleaning/complaints/C-1/photo.png",
        contentType: "image/png"
      })
    });
    expect(apiProvider.upload).toHaveBeenCalledWith("cleaning/complaints/C-1/issues/sink.jpg", {
      data: "data:image/jpeg;base64,def",
      contentType: "image/jpeg",
      metadata: expect.objectContaining({
        ownerType: "cleaning_complaint",
        ownerId: "C-1",
        ownerSubId: "sink",
        kind: "cleaning_complaint_issue_photo",
        path: "cleaning/complaints/C-1/issues/sink.jpg",
        contentType: "image/jpeg"
      })
    });
    await expect(storage.load(stored)).resolves.toBe("data:image/png;base64,abc");
  });

  it("stores production round issue photos without embedding base64 in the round record", async () => {
    const apiProvider = { upload: vi.fn().mockResolvedValue(true) };
    const storage = createCleaningPhotoStorage({
      appMode: "production",
      provider: "api",
      apiBaseUrl: "https://cmms.example/api",
      apiProvider
    });

    await expect(storage.saveRound({
      id: "R-1",
      issues: [{ itemId: "floor", photo: "data:image/webp;base64,abc", reason: "dirty" }]
    })).resolves.toEqual({
      id: "R-1",
      issues: [{ itemId: "floor", photo: null, photoPath: "cleaning/rounds/R-1/issues/floor.webp", hasPhoto: true, reason: "dirty" }]
    });
    expect(apiProvider.upload).toHaveBeenCalledWith("cleaning/rounds/R-1/issues/floor.webp", {
      data: "data:image/webp;base64,abc",
      contentType: "image/webp",
      metadata: expect.objectContaining({
        ownerType: "cleaning_round",
        ownerId: "R-1",
        ownerSubId: "floor",
        kind: "cleaning_round_issue_photo",
        path: "cleaning/rounds/R-1/issues/floor.webp",
        contentType: "image/webp"
      })
    });
  });

  it("removes production cleaning photos referenced by a complaint or round record", async () => {
    const apiProvider = { delete: vi.fn().mockResolvedValue(true) };
    const storage = createCleaningPhotoStorage({
      appMode: "production",
      provider: "api",
      apiBaseUrl: "https://cmms.example/api",
      apiProvider
    });

    await storage.removeRecord({
      id: "C-1",
      photoPath: "cleaning/complaints/C-1/photo.jpg",
      issues: [
        { photoPath: "cleaning/complaints/C-1/issues/sink.jpg" },
        { photoPath: "cleaning/complaints/C-1/issues/sink.jpg" }
      ]
    });

    expect(apiProvider.delete).toHaveBeenCalledTimes(2);
    expect(apiProvider.delete).toHaveBeenCalledWith("cleaning/complaints/C-1/photo.jpg");
    expect(apiProvider.delete).toHaveBeenCalledWith("cleaning/complaints/C-1/issues/sink.jpg");
  });

  it("keeps demo/local cleaning photos inline for current review data compatibility", async () => {
    const storage = createCleaningPhotoStorage({ appMode: "demo", provider: "local" });
    const complaint = { id: "C-1", photo: "data:image/jpeg;base64,abc", issues: [{ itemId: "sink", photo: "data:image/jpeg;base64,def" }] };
    const round = { id: "R-1", issues: [{ itemId: "floor", photo: "data:image/jpeg;base64,ghi" }] };

    await expect(storage.saveComplaint(complaint)).resolves.toBe(complaint);
    await expect(storage.saveRound(round)).resolves.toBe(round);
    await expect(storage.load(complaint)).resolves.toBe("data:image/jpeg;base64,abc");
  });

  it("builds stable cleaning photo paths", () => {
    expect(cleaningComplaintPhotoPath("C 1", "data:image/png;base64,abc")).toBe("cleaning/complaints/C-1/photo.png");
    expect(cleaningComplaintIssuePhotoPath("C 1", { itemId: "sink/1" }, 0, "data:image/jpeg;base64,abc")).toBe("cleaning/complaints/C-1/issues/sink-1.jpg");
    expect(cleaningRoundIssuePhotoPath("R 1", {}, 2, "data:image/webp;base64,abc")).toBe("cleaning/rounds/R-1/issues/issue-3.webp");
  });
});
