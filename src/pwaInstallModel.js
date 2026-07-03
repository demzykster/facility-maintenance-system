export function isStandaloneDisplay({ matchMedia, navigator } = {}) {
  const standaloneMedia = typeof matchMedia === "function" && matchMedia("(display-mode: standalone)")?.matches === true;
  const iosStandalone = navigator?.standalone === true;
  return standaloneMedia || iosStandalone;
}

export function isIosDevice(userAgent = "", platform = "", maxTouchPoints = 0) {
  const ua = String(userAgent || "");
  const pf = String(platform || "");
  return /iPad|iPhone|iPod/i.test(ua) || (pf === "MacIntel" && Number(maxTouchPoints || 0) > 1);
}

export function pwaInstallPromptMode({ beforeInstallPromptEvent, isStandalone = false, userAgent = "", platform = "", maxTouchPoints = 0 } = {}) {
  if (isStandalone) return "hidden";
  if (beforeInstallPromptEvent) return isIosDevice(userAgent, platform, maxTouchPoints) ? "ios" : "browser";
  if (isIosDevice(userAgent, platform, maxTouchPoints)) return "ios";
  return "hidden";
}
