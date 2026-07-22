import { brandCompanyName, brandShortName, brandSiteSubtitle } from "./brandConfigModel.js";
import { brandIconHref } from "./brandIconModel.js";

function appIcons(config = {}) {
  const icon = brandIconHref(config);
  return [
    { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: icon, sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: icon, sizes: "512x512", type: "image/png", purpose: "maskable" }
  ];
}

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
    icons: appIcons(config)
  };
}
