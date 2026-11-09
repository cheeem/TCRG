import { TcrgClient } from "../../client/tcrg.js";
import tcrgWasmUrl from "../../client/tcrg.wasm?url";

const judgeUrl = "https://localhost:4443";
const certHex = "3c35bc0c1e9360323d750e537b07c731c98e9afacb785c519d77e745a40718e2";

const client = new TcrgClient(tcrgWasmUrl, judgeUrl, certHex);

client.addEventListener("disconnected", () => console.log("disconnected"));

window.addEventListener("click", () => {
  console.log("hi");
  console.log(client.getNodeIndex());
});

client.open();
