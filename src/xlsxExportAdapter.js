import writeExcelFile from "write-excel-file/browser";

const escapeHtml = (value) => String(value ?? "")
  .split("&").join("&amp;")
  .split("<").join("&lt;")
  .split(">").join("&gt;")
  .split(String.fromCharCode(34)).join("&quot;")
  .split(String.fromCharCode(39)).join("&#39;");

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const jsonToSheet = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headers = [];
  safeRows.forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    Object.keys(row).forEach((key) => {
      if (!headers.includes(key)) headers.push(key);
    });
  });
  return {
    __headers: headers,
    __rows: safeRows,
    __data: [
      headers,
      ...safeRows.map((row) => headers.map((header) => row?.[header] ?? ""))
    ]
  };
};

const bookNew = () => ({ SheetNames: [], Sheets: {} });

const bookAppendSheet = (workbook, sheet, name) => {
  const sheetName = String(name || `Sheet${workbook.SheetNames.length + 1}`);
  workbook.SheetNames.push(sheetName);
  workbook.Sheets[sheetName] = sheet;
};

const sheetToCsv = (sheet = {}) => (sheet.__data || [])
  .map((row) => row.map(csvCell).join(","))
  .join("\r\n");

const sheetToHtml = (sheet = {}) => {
  const rows = sheet.__data || [];
  const body = rows.map((row, rowIndex) => {
    const tag = rowIndex === 0 ? "th" : "td";
    return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
  }).join("");
  return `<table>${body}</table>`;
};

const columnsForSheet = (sheet = {}) => {
  const widths = Array.isArray(sheet["!cols"]) ? sheet["!cols"] : [];
  return widths.map((col) => ({ width: Number(col?.wch) || 14 }));
};

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

export const XLSX = {
  utils: {
    json_to_sheet: jsonToSheet,
    book_new: bookNew,
    book_append_sheet: bookAppendSheet,
    sheet_to_csv: sheetToCsv,
    sheet_to_html: sheetToHtml
  }
};
