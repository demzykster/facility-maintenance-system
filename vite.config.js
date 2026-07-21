import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildAppManifest } from "./src/appManifestModel.js";

const packageInfo = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const gitCommit = () => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
};

const buildCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || gitCommit();
const buildTime = new Date().toISOString();

const localManifestMiddleware = (req, res, next) => {
  if (new URL(req.url || "/", "http://localhost").pathname !== "/manifest.webmanifest") return next();
  res.statusCode = 200;
  res.setHeader("content-type", "application/manifest+json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  if (String(req.method || "GET").toUpperCase() === "HEAD") return res.end();
  return res.end(JSON.stringify(buildAppManifest({})));
};

export default defineConfig({
  cacheDir: "vite-cache",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
          if (id.includes("/lucide-react/") || id.includes("/lucide/")) return "vendor-icons";
          return undefined;
        }
      }
    }
  },
  optimizeDeps: {
    include: ["jsqr"]
  },
  plugins: [
    {
      name: "cmms-local-manifest",
      configureServer(server) {
        server.middlewares.use(localManifestMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(localManifestMiddleware);
      }
    },
    {
      name: "cmms-version-manifest",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "cmms-version.json",
          source: JSON.stringify({
            version: packageInfo.version || "0.0.0",
            commit: buildCommit,
            buildTime
          }, null, 2)
        });
      }
    }
  ],
  define: {
    __CMMS_BUILD_COMMIT__: JSON.stringify(buildCommit),
    __CMMS_BUILD_TIME__: JSON.stringify(buildTime)
  },
  server: {
    host: "127.0.0.1"
  }
});
