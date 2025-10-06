"use strict";
const express = require("express");
const crypto = require("node:crypto");
const mcp = require("../../server/mcp.js");
const streamableHttp = require("../../server/streamableHttp.js");
const sse = require("../../server/sse.js");
const zod = require("zod");
const types = require("../../types.js");
const inMemoryEventStore = require("../shared/inMemoryEventStore.js");
const cors = require("cors");
const getServer = () => {
  const server = new mcp.McpServer(
    {
      name: "backwards-compatible-server",
      version: "1.0.0"
    },
    { capabilities: { logging: {} } }
  );
  server.tool(
    "start-notification-stream",
    "Starts sending periodic notifications for testing resumability",
    {
      interval: zod.z.number().describe("Interval in milliseconds between notifications").default(100),
      count: zod.z.number().describe("Number of notifications to send (0 for 100)").default(50)
    },
    async ({ interval, count }, extra) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      let counter = 0;
      while (count === 0 || counter < count) {
        counter++;
        try {
          await server.sendLoggingMessage(
            {
              level: "info",
              data: `Periodic notification #${counter} at ${(/* @__PURE__ */ new Date()).toISOString()}`
            },
            extra.sessionId
          );
        } catch (error) {
          console.error("Error sending notification:", error);
        }
        await sleep(interval);
      }
      return {
        content: [
          {
            type: "text",
            text: `Started sending periodic notifications every ${interval}ms`
          }
        ]
      };
    }
  );
  return server;
};
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    // Allow all origins - adjust as needed for production
    exposedHeaders: ["Mcp-Session-Id"]
  })
);
const transports = {};
app.all("/mcp", async (req, res) => {
  console.log(`Received ${req.method} request to /mcp`);
  try {
    const sessionId = req.headers["mcp-session-id"];
    let transport;
    if (sessionId && transports[sessionId]) {
      const existingTransport = transports[sessionId];
      if (existingTransport instanceof streamableHttp.StreamableHTTPServerTransport) {
        transport = existingTransport;
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Bad Request: Session exists but uses a different transport protocol"
          },
          id: null
        });
        return;
      }
    } else if (!sessionId && req.method === "POST" && types.isInitializeRequest(req.body)) {
      const eventStore = new inMemoryEventStore.InMemoryEventStore();
      transport = new streamableHttp.StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        eventStore,
        // Enable resumability
        onsessioninitialized: (sessionId2) => {
          console.log(`StreamableHTTP session initialized with ID: ${sessionId2}`);
          transports[sessionId2] = transport;
        }
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`Transport closed for session ${sid}, removing from transports map`);
          delete transports[sid];
        }
      };
      const server = getServer();
      await server.connect(transport);
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
app.get("/sse", async (req, res) => {
  console.log("Received GET request to /sse (deprecated SSE transport)");
  const transport = new sse.SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  const server = getServer();
  await server.connect(transport);
});
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  let transport;
  const existingTransport = transports[sessionId];
  if (existingTransport instanceof sse.SSEServerTransport) {
    transport = existingTransport;
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32e3,
        message: "Bad Request: Session exists but uses a different transport protocol"
      },
      id: null
    });
    return;
  }
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});
const PORT = 3e3;
app.listen(PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`Backwards compatible MCP server listening on port ${PORT}`);
  console.log(`
==============================================
SUPPORTED TRANSPORT OPTIONS:

1. Streamable Http(Protocol version: 2025-03-26)
   Endpoint: /mcp
   Methods: GET, POST, DELETE
   Usage: 
     - Initialize with POST to /mcp
     - Establish SSE stream with GET to /mcp
     - Send requests with POST to /mcp
     - Terminate session with DELETE to /mcp

2. Http + SSE (Protocol version: 2024-11-05)
   Endpoints: /sse (GET) and /messages (POST)
   Usage:
     - Establish SSE stream with GET to /sse
     - Send requests with POST to /messages?sessionId=<id>
==============================================
`);
});
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  console.log("Server shutdown complete");
  process.exit(0);
});
//# sourceMappingURL=sseAndStreamableHttpCompatibleServer.js.map
