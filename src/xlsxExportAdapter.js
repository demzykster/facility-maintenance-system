import writeExcelFile from "write-excel-file/browser";
import { columnsForSheet } from "./xlsxWorkbookModel.js";

export async function workbookToBlob(workbook) {
  const sheets = (workbook.SheetNames || []).map((sheetName) => {
    const sheet = workbook.Sheets[sheetName] || {};
    const columns = columnsForSheet(sheet);
    return {
      sheet: sheetName,
      data: sheet.__data || [],
      ...(columns.length ? { columns } : {})
    };
  });
  if (!sheets.length) throw new Error("workbook_empty");
  const output = sheets.length === 1
    ? writeExcelFile(sheets[0].data, sheets[0].columns ? { columns: sheets[0].columns } : undefined)
    : writeExcelFile(sheets);
  return output.toBlob();
}
