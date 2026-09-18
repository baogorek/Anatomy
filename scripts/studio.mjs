import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const python = root + ".venv-opensim/bin/python";
let backend,
  frontend,
  exiting = false;
function stop(code = 0) {
  if (exiting) return;
  exiting = true;
  backend?.kill("SIGTERM");
  frontend?.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
async function healthy() {
  let data;
  try {
    const r = await fetch("http://127.0.0.1:8765/api/biomechanics/health", {
      signal: AbortSignal.timeout(500),
    });
    data = await r.json();
  } catch {
    return false;
  }
  if (data.service !== "kinetic-opensim") return false;
  const manifest = root + "biomechanics/runtime-manifest.json";
  const expected = existsSync(manifest)
    ? JSON.parse(readFileSync(manifest, "utf8")).native.id
    : null;
  if (
    !expected ||
    data.calculationBuild !== expected ||
    !data.regions?.includes("neck") ||
    !data.regions?.includes("spine") ||
    !data.regions?.includes("wholebody") ||
    data.longestPathSearch !== "native-longest-path-v1"
  ) {
    console.error(
      "An older OpenSim service is running on port 8765. Stop that studio process and restart npm run dev to load the current models and package.",
    );
    stop(1);
    return false;
  }
  return true;
}
if (!(await healthy())) {
  if (exiting) process.exit(1);
  if (!existsSync(python)) {
    console.error(
      "Run npm run setup:biomechanics first. The atlas can also run with npx vite.",
    );
    process.exit(1);
  }
  backend = spawn(python, ["biomechanics/server.py"], {
    cwd: root,
    stdio: "inherit",
  });
  backend.on("exit", (code) => {
    if (!exiting) stop(code || 1);
  });
  let ready = false;
  for (let i = 0; i < 100 && !exiting; i++) {
    if (await healthy()) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) {
    console.error("OpenSim did not start.");
    stop(1);
  }
}
if (!exiting) {
  frontend = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      ...process.argv.slice(2),
      "--host",
      "0.0.0.0",
    ],
    { cwd: root, stdio: "inherit" },
  );
  frontend.on("exit", (code) => stop(code || 0));
}
