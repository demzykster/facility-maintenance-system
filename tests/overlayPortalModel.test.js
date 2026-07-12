import { describe, expect, it } from "vitest";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("overlay portal behavior", () => {
  it("renders overlays through document.body so nested dialogs are not clipped by parent panels", () => {
    expect(appSource).toContain('import { createPortal } from "react-dom";');
    expect(appSource).toContain("createPortal(node, document.body)");
  });

  it("opens worker creation forms with a fixed-height panel from nested pickers", () => {
    expect(appSource.match(/panelClassName="user-picker-form-panel"/g)).toHaveLength(2);
    expect(appSource).toContain(".ovl-panel.user-picker-form-panel{height:min(92dvh,780px);max-height:92dvh;}");
  });
});
