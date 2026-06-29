import { spawn } from "node:child_process";

const steps = [
  ["staging:preflight:local", ["npm", ["run", "staging:preflight:local"]]],
  ["staging:supabase-schema", ["npm", ["run", "staging:supabase-schema"]]],
  ["staging:vercel-env", ["npm", ["run", "staging:vercel-env"]]],
  ["staging:smoke:live:strict", ["npm", ["run", "staging:smoke:live", "--", "--expect-current-commit"]]]
];

function runStep(label, [command, args]) {
  return new Promise((resolve, reject) => {
    console.log(`[staging-gate] start ${label}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`[staging-gate] ok ${label}`);
        resolve();
      } else {
        reject(new Error(`${label}_failed:${code}`));
      }
    });
  });
}

for (const step of steps) {
  try {
    await runStep(...step);
  } catch (error) {
    console.error(`[staging-gate] failed ${error?.message || error}`);
    process.exit(1);
  }
}

console.log("[staging-gate] all checks passed");
