import { spawn } from "node:child_process";


const processes = [];

for (let i = 0; i < 64; i++) {
  const child = spawn("node", ["node-server.js", String(i)], {
    stdio: "inherit"
  });

  processes.push(child)
}

process.on("SIGINT", () => {
  for (const child of processes) {
    child.kill();
  }
  process.exit()
})

