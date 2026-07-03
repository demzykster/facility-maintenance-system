import { describe, expect, it } from "vitest";
import {
  FILE_KINDS,
  FILE_METADATA_TABLE_CONTRACT,
  FILE_OWNER_TYPES,
  cleaningComplaintIssuePhotoMetadata,
  cleaningComplaintPhotoMetadata,
  cleaningRoundIssuePhotoMetadata,
  fileMetadataPathMatchesOwner,
  fileMetadataId,
  normalizeFileMetadata,
  ticketPhotoMetadata
} from "../src/fileMetadataModel.js";

describe("fileMetadataModel", () => {
  it("normalizes the minimum durable file metadata record", () => {
    expect(normalizeFileMetadata({
      ownerType: FILE_OWNER_TYPES.ticket,
      ownerId: "T-1",
      kind: FILE_KINDS.ticketBeforePhoto,
      path: "tickets/T-1/before.jpg",
      contentType: "image/jpeg",
      createdAt: 123
    })).toEqual({
      id: "ticket:T-1:ticket_before_photo:tickets/T-1/before.jpg",
      ownerType: "ticket",
      ownerId: "T-1",
      ownerSubId: "",
      kind: "ticket_before_photo",
      path: "tickets/T-1/before.jpg",
      contentType: "image/jpeg",
      storageProvider: "supabase",
      bucket: "cmms-files",
      sizeBytes: 0,
      createdById: "",
      createdByName: "",
      createdByRole: "",
      createdAt: 123,
      deletedAt: null
    });
  });

  it("rejects unsafe or unknown metadata", () => {
    expect(() => normalizeFileMetadata({ ownerType: "other", ownerId: "1", kind: FILE_KINDS.attachment, path: "x" })).toThrow("file_owner_type_invalid");
    expect(() => normalizeFileMetadata({ ownerType: FILE_OWNER_TYPES.ticket, kind: FILE_KINDS.attachment, path: "x" })).toThrow("file_owner_id_required");
    expect(() => normalizeFileMetadata({ ownerType: FILE_OWNER_TYPES.ticket, ownerId: "1", kind: "other", path: "x" })).toThrow("file_kind_invalid");
    expect(() => normalizeFileMetadata({ ownerType: FILE_OWNER_TYPES.ticket, ownerId: "1", kind: FILE_KINDS.attachment, path: "../secret" })).toThrow("file_path_invalid");
    expect(() => normalizeFileMetadata({ ownerType: FILE_OWNER_TYPES.ticket, ownerId: "1", kind: FILE_KINDS.attachment, path: "/secret" })).toThrow("file_path_invalid");
  });

  it("builds metadata for ticket photos from the current ticket shape", () => {
    expect(ticketPhotoMetadata({
      id: "T-9",
      createdAt: 100,
      updatedAt: 200,
      createdBy: { id: "u1", name: "Owner", role: "admin" }
    }, "after", "tickets/T-9/after.png", { contentType: "image/png", sizeBytes: 512 })).toMatchObject({
      ownerType: "ticket",
      ownerId: "T-9",
      kind: "ticket_after_photo",
      path: "tickets/T-9/after.png",
      contentType: "image/png",
      sizeBytes: 512,
      createdById: "u1",
      createdByName: "Owner",
      createdByRole: "admin",
      createdAt: 200
    });
  });

  it("builds metadata for cleaning complaint and round issue photos", () => {
    expect(cleaningComplaintPhotoMetadata({
      id: "C-1",
      at: 300,
      reportedById: "cleaner-1",
      reportedByName: "Cleaner",
      reportedByRole: "cleaner"
    }, "cleaning/complaints/C-1/photo.jpg")).toMatchObject({
      ownerType: "cleaning_complaint",
      ownerId: "C-1",
      kind: "cleaning_complaint_photo",
      createdById: "cleaner-1",
      createdAt: 300
    });

    expect(cleaningComplaintIssuePhotoMetadata({
      id: "C-1",
      at: 300,
      reportedById: "cleaner-1",
      reportedByName: "Cleaner",
      reportedByRole: "cleaner"
    }, { itemId: "sink" }, "cleaning/complaints/C-1/issues/sink.jpg")).toMatchObject({
      ownerType: "cleaning_complaint",
      ownerId: "C-1",
      ownerSubId: "sink",
      kind: "cleaning_complaint_issue_photo",
      createdById: "cleaner-1",
      createdAt: 300
    });

    expect(cleaningRoundIssuePhotoMetadata({
      id: "R-1",
      at: 400,
      byUid: "cleaner-2",
      byName: "Cover",
      byRole: "cleaner"
    }, { itemId: "sink" }, "cleaning/rounds/R-1/issues/sink.webp")).toMatchObject({
      ownerType: "cleaning_round",
      ownerId: "R-1",
      ownerSubId: "sink",
      kind: "cleaning_round_issue_photo",
      createdById: "cleaner-2",
      createdAt: 400
    });
  });

  it("checks known owner metadata against the storage path", () => {
    expect(fileMetadataPathMatchesOwner({
      ownerType: FILE_OWNER_TYPES.ticket,
      ownerId: "T-1",
      kind: FILE_KINDS.ticketBeforePhoto,
      path: "tickets/T-1/before.jpg"
    })).toBe(true);
    expect(fileMetadataPathMatchesOwner({
      ownerType: FILE_OWNER_TYPES.ticket,
      ownerId: "T-1",
      kind: FILE_KINDS.ticketBeforePhoto,
      path: "tickets/T-2/before.jpg"
    })).toBe(false);
    expect(fileMetadataPathMatchesOwner({
      ownerType: FILE_OWNER_TYPES.cleaningComplaint,
      ownerId: "C-1",
      kind: FILE_KINDS.cleaningComplaintPhoto,
      path: "cleaning/complaints/C-1/photo.jpg"
    })).toBe(true);
  });

  it("documents the future Supabase table fields in one contract", () => {
    expect(FILE_METADATA_TABLE_CONTRACT).toEqual([
      "id",
      "owner_type",
      "owner_id",
      "owner_sub_id",
      "kind",
      "path",
      "content_type",
      "storage_provider",
      "bucket",
      "size_bytes",
      "created_by_id",
      "created_by_name",
      "created_by_role",
      "created_at",
      "deleted_at"
    ]);
    expect(fileMetadataId({ ownerType: "ticket", ownerId: "T 1", kind: "photo", path: "tickets/T 1/a.jpg" })).toBe("ticket:T-1:photo:tickets/T-1/a.jpg");
  });
});
