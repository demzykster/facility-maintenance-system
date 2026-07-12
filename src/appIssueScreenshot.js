const SENSITIVE_INPUT_TYPES = new Set(["password", "email", "tel"]);
const SENSITIVE_NAME_PATTERN = /(password|pass|pin|secret|token|email|mail|phone|tel)/i;

const loadHtml2Canvas = () => import("html2canvas").then((module) => module.default || module);

export function appIssueScreenContext({ windowRef = globalThis.window, navigatorRef = globalThis.navigator } = {}) {
  const location = windowRef?.location
    ? `${windowRef.location.pathname || "/"}${windowRef.location.search || ""}`
    : "";
  return {
    location,
    userAgent: navigatorRef?.userAgent || "",
    viewport: windowRef ? `${windowRef.innerWidth || 0}x${windowRef.innerHeight || 0}` : "",
    devicePixelRatio: Number(windowRef?.devicePixelRatio || 1),
  };
}

export function maskSensitiveFields(root) {
  if (!root?.querySelectorAll) return 0;
  let masked = 0;
  root.querySelectorAll("input, textarea, [contenteditable='true']").forEach((node) => {
    const tag = String(node.tagName || "").toLowerCase();
    const type = String(node.getAttribute?.("type") || "").toLowerCase();
    const name = [
      node.getAttribute?.("name"),
      node.getAttribute?.("id"),
      node.getAttribute?.("autocomplete"),
      node.getAttribute?.("aria-label"),
      node.getAttribute?.("placeholder"),
    ].filter(Boolean).join(" ");
    const sensitive = SENSITIVE_INPUT_TYPES.has(type) || SENSITIVE_NAME_PATTERN.test(name);
    if (!sensitive && tag !== "textarea") return;
    if ("value" in node) node.value = sensitive ? "••••••" : "";
    node.setAttribute?.("value", sensitive ? "••••••" : "");
    node.textContent = sensitive ? "••••••" : "";
    masked += 1;
  });
  root.querySelectorAll("[data-private], [data-sensitive], .private, .sensitive").forEach((node) => {
    node.textContent = "••••••";
    masked += 1;
  });
  return masked;
}

export async function captureAppIssueScreenshot({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator,
  target = null,
  maxWidth = 960,
  quality = 0.72,
  html2canvasLoader = loadHtml2Canvas,
} = {}) {
  const context = appIssueScreenContext({ windowRef, navigatorRef });
  const node = target || documentRef?.querySelector?.(".app-shell") || documentRef?.body;
  if (!node) return { screenshot: "", context, error: "capture_target_missing" };
  try {
    const html2canvas = await html2canvasLoader();
    const canvas = await html2canvas(node, {
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: Math.min(1.5, Math.max(1, Number(windowRef?.devicePixelRatio || 1))),
      onclone: (clonedDocument) => {
        maskSensitiveFields(clonedDocument);
        clonedDocument.querySelectorAll?.(".toast,.toast-ok,.ai-fab,.fab,[role='dialog']").forEach((el) => {
          el.style.visibility = "hidden";
        });
      },
    });
    const ratio = canvas.width > maxWidth ? maxWidth / canvas.width : 1;
    const out = ratio < 1 ? documentRef.createElement("canvas") : canvas;
    if (ratio < 1) {
      out.width = Math.round(canvas.width * ratio);
      out.height = Math.round(canvas.height * ratio);
      out.getContext("2d").drawImage(canvas, 0, 0, out.width, out.height);
    }
    return {
      screenshot: out.toDataURL("image/jpeg", quality),
      context: {
        ...context,
        screenshotSize: `${out.width}x${out.height}`,
      },
      error: "",
    };
  } catch (error) {
    return { screenshot: "", context, error: error?.message || "capture_failed" };
  }
}
