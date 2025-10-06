"use strict";
const express = require("express");
const crypto = require("node:crypto");
const mcp = require("../../server/mcp.js");
const streamableHttp = require("../../server/streamableHttp.js");
const types = require("../../types.js");
const server = new mcp.McpServer({
  name: "resource-list-changed-notification-server",
  version: "1.0.0"
});
const transports = {};
const addResource = (name, content) => {
  const uri = `https://mcp-example.com/dynamic/${encodeURIComponent(name)}`;
  server.resource(
    name,
    uri,
    { mimeType: "text/plain", description: `Dynamic resource: ${name}` },
    async () => {
      return {
        contents: [{ uri, text: content }]
      };
    }
  );
};
addResource("example-resource", "Initial content for example-resource");
const resourceChangeInterval = setInterval(() => {
  const name = crypto.randomUUID();
  addResource(name, `Content for ${name}`);
}, 5e3);
const app = express();
app.use(express.json());
app.post("/mcp", async (req, res) => {
  console.log("Received MCP request:", req.body);
  try {
    const sessionId = req.headers["mcp-session-id"];
    let transport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && types.isInitializeRequest(req.body)) {
      transport = new streamableHttp.StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sessionId2) => {
          console.log(`Session initialized with ID: ${sessionId2}`);
          transports[sessionId2] = transport;
        }
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32e3,
          message: "Bad Request: No valid session ID provided"
        },
        id: null
      });
      return;
    }
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error"
        },
        id: null
      });
    }
  }
});
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  console.log(`Establishing SSE stream for session ${sessionId}`);
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});
const PORT = 3e3;
app.listen(PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`Server listening on port ${PORT}`);
});
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  clearInterval(resourceChangeInterval);
  await server.close();
  process.exit(0);
});
//# sourceMappingURL=standaloneSseWithGetStreamableHttp.js.map
