import { WebTransport, quicheLoaded } from "@fails-components/webtransport";
import { readFileSync } from "node:fs";
import { X509Certificate, randomBytes } from "node:crypto";
await quicheLoaded;

const cert = new X509Certificate(readFileSync("./certs/cert.pem"));

const fingerprint = new Uint8Array(
  cert.fingerprint256
    .split(":")
    .map(byte => parseInt(byte, 16))
);

console.log("Certificate fingerprint:", cert.fingerprint256);

const transport = new WebTransport(
  "https://127.0.0.1:4443/wt",
  {
    requireUnreliable: true,
    serverCertificateHashes: [
      { algorithm: "sha-256", value: fingerprint }
    ]
  }
);

transport.closed.catch(console.error);

function generateMask() {
  let mask = 0n;

  while (mask === 0n) {
    const bytes = randomBytes(8);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    mask = view.getBigUint64(0, true);
  }

  return mask;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

try {
  console.log("Connecting................");
  await transport.ready;

  console.log("Connected successfully!");

  const stream = await transport.createUnidirectionalStream();
  const writer = stream.getWriter();

  let sequence = 0;

  while (true) {
    const mask = generateMask();
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, mask, true);

    await writer.write(new Uint8Array(buffer));
    sequence++;
    console.log(`Message ${sequence}:`, mask.toString(), "0x" + mask.toString(16).padStart(16, "0"));
    await delay(300);
  }

} catch (error) {
  console.error("Judge error:", error);
  transport.close();
}
