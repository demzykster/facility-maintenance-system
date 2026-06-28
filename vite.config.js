import { defineConfig } from "vite";
import { execSync } from "node:child_process";

const gitCommit = () => {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "local";
  }
};

export default defineConfig({
  cacheDir: "vite-cache",
  define: {
    __CMMS_BUILD_COMMIT__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || gitCommit()),
    __CMMS_BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  server: {
    host: "127.0.0.1"
  }
});
