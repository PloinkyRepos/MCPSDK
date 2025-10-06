import express from "express";
import { McpServer } from "../../server/mcp.js";
import { SSEServerTransport } from "../../server/sse.js";
import { z } from "zod";
const getServer = () => {
  const server = new McpServer(
    {
      name: "simple-sse-server",
      version: "1.0.0"
    },
    { capabilities: { logging: {} } }
  );
  server.tool(
    "start-notification-stream",
    "Starts sending periodic notifications",
    {
      interval: z.number().describe("Interval in milliseconds between notifications").default(1e3),
      count: z.number().describe("Number of notifications to send").default(10)
    },
    async ({ interval, count }, extra) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      let counter = 0;
      await server.sendLoggingMessage(
        {
          level: "info",
          data: `Starting notification stream with ${count} messages every ${interval}ms`
        },
        extra.sessionId
      );
      while (counter < count) {
        counter++;
        await sleep(interval);
        try {
          await server.sendLoggingMessage(
            {
              level: "info",
              data: `Notification #${counter} at ${(/* @__PURE__ */ new Date()).toISOString()}`
            },
            extra.sessionId
          );
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
      return {
        content: [
          {
            type: "text",
            text: `Completed sending ${count} notifications every ${interval}ms`
          }
        ]
      };
    }
  );
  return server;
};
const app = express();
app.use(express.json());
const transports = {};
app.get("/mcp", async (req, res) => {
  console.log("Received GET request to /sse (establishing SSE stream)");
  try {
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;
    transport.onclose = () => {
      console.log(`SSE transport closed for session ${sessionId}`);
      delete transports[sessionId];
    };
    const server = getServer();
    await server.connect(transport);
    console.log(`Established SSE stream with session ID: ${sessionId}`);
  } catch (error) {
    console.error("Error establishing SSE stream:", error);
    if (!res.headersSent) {
      res.status(500).send("Error establishing SSE stream");
    }
  }
});
app.post("/messages", async (req, res) => {
  console.log("Received POST request to /messages");
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    console.error("No session ID provided in request URL");
    res.status(400).send("Missing sessionId parameter");
    return;
  }
  const transport = transports[sessionId];
  if (!transport) {
    console.error(`No active transport found for session ID: ${sessionId}`);
    res.status(404).send("Session not found");
    return;
  }
  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error("Error handling request:", error);
    if (!res.headersSent) {
      res.status(500).send("Error handling request");
    }
  }
});
const PORT = 3e3;
app.listen(PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`Simple SSE Server (deprecated protocol version 2024-11-05) listening on port ${PORT}`);
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
//# sourceMappingURL=simpleSseServer.js.map
