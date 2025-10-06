"use strict";
const express = require("express");
const mcp = require("../../server/mcp.js");
const streamableHttp = require("../../server/streamableHttp.js");
const zod = require("zod");
const cors = require("cors");
const getServer = () => {
  const server = new mcp.McpServer(
    {
      name: "stateless-streamable-http-server",
      version: "1.0.0"
    },
    { capabilities: { logging: {} } }
  );
  server.prompt(
    "greeting-template",
    "A simple greeting prompt template",
    {
      name: zod.z.string().describe("Name to include in greeting")
    },
    async ({ name }) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please greet ${name} in a friendly manner.`
            }
          }
        ]
      };
    }
  );
  server.tool(
    "start-notification-stream",
    "Starts sending periodic notifications for testing resumability",
    {
      interval: zod.z.number().describe("Interval in milliseconds between notifications").default(100),
      count: zod.z.number().describe("Number of notifications to send (0 for 100)").default(10)
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
  server.resource(
    "greeting-resource",
    "https://example.com/greetings/default",
    { mimeType: "text/plain" },
    async () => {
      return {
        contents: [
          {
            uri: "https://example.com/greetings/default",
            text: "Hello, world!"
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
app.post("/mcp", async (req, res) => {
  const server = getServer();
  try {
    const transport = new streamableHttp.StreamableHTTPServerTransport({
      sessionIdGenerator: void 0
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      console.log("Request closed");
      transport.close();
      server.close();
    });
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
  console.log("Received GET MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32e3,
        message: "Method not allowed."
      },
      id: null
    })
  );
});
app.delete("/mcp", async (req, res) => {
  console.log("Received DELETE MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32e3,
        message: "Method not allowed."
      },
      id: null
    })
  );
});
const PORT = 3e3;
app.listen(PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
});
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  process.exit(0);
});
//# sourceMappingURL=simpleStatelessStreamableHttp.js.map
