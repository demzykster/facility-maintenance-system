import { describe, expect, it } from "vitest";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("overlay portal behavior", () => {
  it("renders overlays through document.body so nested dialogs are not clipped by parent panels", () => {
    expect(appSource).toContain('import { createPortal } from "react-dom";');
    expect(appSource).toContain("createPortal(node, document.body)");
  });
});
