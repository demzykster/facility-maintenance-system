import { describe, expect, it } from "vitest";
import { XLSX, workbookToBlob } from "../src/xlsxExportAdapter.js";

describe("xlsx export adapter", () => {
  it("keeps the small SheetJS-like surface used by CMMS exports", () => {
    const rows = [
      { name: "Alice", note: "hello" },
      { name: "Bob", note: "comma, quote \" test" }
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "People");

    expect(workbook.SheetNames).toEqual(["People"]);
    expect(XLSX.utils.sheet_to_csv(worksheet)).toContain('"comma, quote "" test"');
    expect(XLSX.utils.sheet_to_html(worksheet)).toContain("<th>name</th>");
    expect(XLSX.utils.sheet_to_html(worksheet)).toContain("comma, quote &quot; test");
  });

  it("creates an xlsx blob from the workbook", async () => {
    const worksheet = XLSX.utils.json_to_sheet([{ name: "Alice", amount: 12 }]);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Export");
    const blob = await workbookToBlob(workbook);

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(1000);
  });
});
