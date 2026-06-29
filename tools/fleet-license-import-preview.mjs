#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import readExcelFile from "read-excel-file/node";
import { buildFleetLicenseImportPreview } from "../src/fleetLicenseImportPreviewModel.js";

const usage = () => {
  console.error("Usage: npm run fleet:import:preview -- <file.xlsx> [--existing-fleet-json file] [--config-json file]");
};

const args = process.argv.slice(2);
const fileArg = args.find((arg) => !arg.startsWith("--"));
const verbose = args.includes("--verbose");
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : "";
};

if (!fileArg) {
  usage();
  process.exit(1);
}

const inputFile = resolve(fileArg);
if (!existsSync(inputFile)) {
  console.error(`[fleet-import-preview] file not found: ${inputFile}`);
  process.exit(1);
}

const readJsonFile = (flag, fallback) => {
  const value = valueAfter(flag);
  if (!value) return fallback;
  const file = resolve(value);
  if (!existsSync(file)) throw new Error(`${flag}_not_found:${file}`);
  return JSON.parse(readFileSync(file, "utf8"));
};

try {
  const existingFleet = readJsonFile("--existing-fleet-json", []);
  const config = readJsonFile("--config-json", {});
  const sheets = await readExcelFile(inputFile);
  const preview = buildFleetLicenseImportPreview(sheets, { existingFleet, config });
  const output = verbose || !preview.ok ? preview : {
    ok: preview.ok,
    sheet: preview.sheet,
    headerRow: preview.headerRow,
    summary: preview.summary,
    catalogAdditions: preview.catalogAdditions,
    conflicts: preview.conflicts,
    invalidRows: preview.invalidRows,
    sampleNewRows: preview.newRows.slice(0, 10),
    omittedNewRows: Math.max(0, preview.newRows.length - 10),
    ignoredHeaders: preview.ignoredHeaders
  };
  console.log(JSON.stringify(output, null, 2));
  if (!preview.ok) process.exit(2);
} catch (error) {
  console.error(`[fleet-import-preview] failed: ${error?.message || error}`);
  process.exit(1);
}
