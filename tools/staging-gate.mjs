import { spawn } from "node:child_process";

const steps = [
  ["staging:preflight:local", ["npm", ["run", "staging:preflight:local"]]],
  ["staging:supabase-schema", ["npm", ["run", "staging:supabase-schema"]]],
  ["staging:data:summary", ["npm", ["run", "staging:data:summary"]]],
  ["staging:vercel-env", ["npm", ["run", "staging:vercel-env"]]],
  ["staging:smoke:live:strict", ["npm", ["run", "staging:smoke:live", "--", "--expect-current-commit"]]],
  ["staging:tickets:reconcile", ["npm", ["run", "staging:tickets:reconcile"]]],
  ["staging:smoke:tickets-api", ["npm", ["run", "staging:smoke:tickets-api"]]],
  ["staging:fleet:reconcile", ["npm", ["run", "staging:fleet:reconcile"]]],
  ["staging:smoke:fleet-api", ["npm", ["run", "staging:smoke:fleet-api"]]],
  ["staging:pm:reconcile", ["npm", ["run", "staging:pm:reconcile"]]],
  ["staging:smoke:pm-api", ["npm", ["run", "staging:smoke:pm-api"]]],
  ["staging:smoke:settings", ["npm", ["run", "staging:smoke:settings"]]],
  ["staging:smoke:fleet-ui", ["npm", ["run", "staging:smoke:fleet-ui"]]],
  ["staging:smoke:ai-intake", ["npm", ["run", "staging:smoke:ai-intake"]]],
  ["staging:smoke:ui:strict", ["npm", ["run", "staging:smoke:ui", "--", "--expect-current-commit"]]]
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
