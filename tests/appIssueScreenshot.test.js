import { describe, expect, it } from "vitest";
import { appIssueScreenContext, maskSensitiveFields } from "../src/appIssueScreenshot.js";

function fakeInput(attrs = {}, value = "secret") {
  return {
    tagName: "INPUT",
    value,
    textContent: value,
    attrs: { ...attrs },
    getAttribute(name) { return this.attrs[name] || ""; },
    setAttribute(name, next) { this.attrs[name] = next; },
  };
}

describe("app issue screenshot helpers", () => {
  it("builds compact runtime context for bug reports", () => {
    expect(appIssueScreenContext({
      windowRef: { location: { pathname: "/settings", search: "?tab=issues" }, innerWidth: 390, innerHeight: 844, devicePixelRatio: 3 },
      navigatorRef: { userAgent: "Vitest Mobile" },
    })).toEqual({
      location: "/settings?tab=issues",
      userAgent: "Vitest Mobile",
      viewport: "390x844",
      devicePixelRatio: 3,
    });
  });

  it("masks sensitive cloned fields before screenshot capture", () => {
    const password = fakeInput({ type: "password", name: "password" });
    const workerPin = fakeInput({ type: "text", name: "pin" }, "1234");
    const ordinary = fakeInput({ type: "text", name: "vehicle" }, "OSE250");
    const root = {
      querySelectorAll(selector) {
        if (selector === "input, textarea, [contenteditable='true']") return [password, workerPin, ordinary];
        return [];
      },
    };

    expect(maskSensitiveFields(root)).toBe(2);
    expect(password.value).toBe("••••••");
    expect(workerPin.value).toBe("••••••");
    expect(ordinary.value).toBe("OSE250");
  });
});
