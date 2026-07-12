import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
  plugins: [{
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
  }],
  define: {
    __CMMS_BUILD_COMMIT__: JSON.stringify(buildCommit),
    __CMMS_BUILD_TIME__: JSON.stringify(buildTime)
  },
  server: {
    host: "127.0.0.1"
  }
});
