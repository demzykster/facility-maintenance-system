import { describe, expect, it } from "vitest";
import { BACKUP_COLLECTIONS } from "../src/backupModel.js";
import { DATA_COLLECTION_KEYS, DATA_COLLECTION_PREFIXES, DATA_COLLECTION_TABLES, DATA_COLLECTIONS } from "../src/dataCollections.js";

const unique = (items) => new Set(items).size === items.length;

describe("production data collections", () => {
  it("keeps backup and production collection maps aligned", () => {
    expect(BACKUP_COLLECTIONS).toBe(DATA_COLLECTIONS);
  });

  it("uses unique backup keys, storage prefixes, and production table names", () => {
    expect(unique(DATA_COLLECTION_KEYS)).toBe(true);
    expect(unique(DATA_COLLECTION_PREFIXES)).toBe(true);
    expect(unique(DATA_COLLECTION_TABLES)).toBe(true);
  });

  it("names every future production table explicitly", () => {
    expect(DATA_COLLECTIONS).toHaveLength(18);
    expect(DATA_COLLECTIONS.every((collection) => collection.table && collection.table.includes(" ") === false)).toBe(true);
  });
});
