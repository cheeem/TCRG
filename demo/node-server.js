import http from "node:http";

const nodeIndex = Number(process.argv[2]);

if (!Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex > 63) {
  throw new Error("Node index must be between 0 and 63.")
}

const port = 8000 + nodeIndex

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });

  res.end(JSON.stringify({
    nodeIndex,
    message: "Hello from node" + nodeIndex
  }));
});


server.listen(port, () => {
  console.log(`Node ${nodeIndex} listening on port ${port}` )
})


