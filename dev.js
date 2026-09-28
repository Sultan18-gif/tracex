const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const pythonVenv = path.join(
  root,
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python"
);
const python = fs.existsSync(pythonVenv)
  ? pythonVenv
  : process.platform === "win32"
    ? "python"
    : "python3";

const services = [
  {
    name: "frontend",
    command: process.execPath,
    args: [path.join(root, "frontend/node_modules/vite/bin/vite.js")],
    cwd: path.join(root, "frontend"),
  },
  {
    name: "backend",
    command: process.execPath,
    args: [path.join(root, "backend/node_modules/nodemon/bin/nodemon.js"), "server.js"],
    cwd: path.join(root, "backend"),
    env: {
      PUBLIC_APP_URL: "http://localhost:5173",
      WEBAUTHN_RP_ID: "localhost",
    },
  },
  {
    name: "ml",
    command: python,
    args: ["-m", "uvicorn", "ml.ml_server:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd: path.join(root, "backend"),
  },
];

let stopping = false;
const children = [];

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }

  setTimeout(() => process.exit(exitCode), 1200).unref();
}

for (const service of services) {
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    env: { ...process.env, ...service.env },
    stdio: ["inherit", "pipe", "pipe"],
    windowsHide: true,
  });
  children.push(child);

  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      for (const line of chunk.trimEnd().split(/\r?\n/)) {
        console.log(`[${service.name}] ${line}`);
      }
    });
  }

  child.on("error", (error) => {
    console.error(`[${service.name}] failed to start: ${error.message}`);
    stopAll(1);
  });

  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`[${service.name}] stopped (exit ${code ?? "unknown"}); stopping the other services.`);
      stopAll(code || 1);
    }
  });
}

console.log("TraceX is starting. Open http://localhost:5173 when Vite is ready (not 127.0.0.1).");
console.log("Press Ctrl+C to stop the frontend, backend, and ML service.");

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
