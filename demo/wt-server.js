import { Http3Server } from "@fails-components/webtransport";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { get } from "node:http";

const server = new Http3Server({
  host: "0.0.0.0",
  port: 4443,
  secret: randomBytes(32).toString("hex"),
  cert: readFileSync("./certs/cert.pem", "utf8"),
  privKey: readFileSync("./certs/key.pem", "utf8"),
});

server.setRequestCallback(async ({ header }) => {
  console.log("Incoming request headers:", header);
  const path = header[":path"];

  if (path !== "/wt") {
    console.log("Rejected path:", path);
    return { status: 404, path };
  }

  console.log("Accepting WebTransport request!");
  return { status: 200, path };
});

const sessions = server.sessionStream("/wt");
server.startServer();
await server.ready;
console.log("Server address:", server.address());

async function contactNode(nodeIndex) {
  const port = 8000 + nodeIndex;
  const url = `http://127.0.0.1:${port}`;

  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve(JSON.parse(data));
      });
    }).on("error", reject);
  });
}

async function processMask(mask) {
  const selectedNodes = [];

  for (let i = 0; i < 64; i++) {
    if ((mask & (1n << BigInt(i))) !== 0n) {
      selectedNodes.push(i);
    }
  }

  console.log("Selected nodes:", selectedNodes);

  const responses = await Promise.all(
    selectedNodes.map(contactNode)
  );

  console.log("Node responses:", responses);
}

async function receiveStream(stream) {
  let pending = new Uint8Array(0);

  for await (const chunk of stream) {
    const bytes = new Uint8Array(chunk);

    const combined = new Uint8Array(pending.length + bytes.length);
    combined.set(pending);
    combined.set(bytes, pending.length);

    pending = combined;

    while (pending.length >= 8) {
      const view = new DataView(
        pending.buffer,
        pending.byteOffset,
        8
      );

      const mask = view.getBigUint64(0, true);

      console.log("Received mask:", mask.toString(), "0x" + mask.toString(16).padStart(16, "0"));
      processMask(mask).catch(console.error);

      pending = pending.slice(8);
    }
  }
}

async function handleSession(session) {
  console.log("Judge connected!");

  for await (const stream of session.incomingUnidirectionalStreams) {
    receiveStream(stream).catch(console.error);
  }
}

(async () => {
  await server.ready;
  console.log("WebTransport server listening on UDP 4443");

  for await (const session of sessions) {
    console.log("Session received!");
  
    session.ready
      .then(() => {
        console.log("Session ready!");
        return handleSession(session);
      })
      .catch(console.error);
  }
})();
