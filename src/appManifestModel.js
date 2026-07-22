import { brandCompanyName, brandShortName, brandSiteSubtitle } from "./brandConfigModel.js";

const APP_ICONS = Object.freeze([
  Object.freeze({ src: "/icons/icon-192-brand-20260711.png", sizes: "192x192", type: "image/png", purpose: "any" }),
  Object.freeze({ src: "/icons/icon-192-brand-20260711.png", sizes: "192x192", type: "image/png", purpose: "maskable" }),
  Object.freeze({ src: "/icons/icon-512-brand-20260711.png", sizes: "512x512", type: "image/png", purpose: "any" }),
  Object.freeze({ src: "/icons/icon-512-brand-20260711.png", sizes: "512x512", type: "image/png", purpose: "maskable" }),
  Object.freeze({ src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" })
]);

export function buildAppManifest(config = {}) {
  return {
    name: brandCompanyName(config),
    short_name: brandShortName(config),
    description: brandSiteSubtitle(config),
    start_url: "/",
    scope: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#FFFFFF",
    theme_color: "#1F4E8C",
    icons: APP_ICONS.map((icon) => ({ ...icon }))
  };
}
