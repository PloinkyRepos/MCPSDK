import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "../../server/mcp.js";
import { StreamableHTTPServerTransport } from "../../server/streamableHttp.js";
import { z } from "zod";
import { isInitializeRequest } from "../../types.js";
import cors from "cors";
const getServer = () => {
  const server = new McpServer(
    {
      name: "json-response-streamable-http-server",
      version: "1.0.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );
  server.tool(
    "greet",
    "A simple greeting tool",
    {
      name: z.string().describe("Name to greet")
    },
    async ({ name }) => {
      return {
        content: [
          {
            type: "text",
            text: `Hello, ${name}!`
          }
        ]
      };
    }
  );
  server.tool(
    "multi-greet",
    "A tool that sends different greetings with delays between them",
    {
      name: z.string().describe("Name to greet")
    },
    async ({ name }, extra) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      await server.sendLoggingMessage(
        {
          level: "debug",
          data: `Starting multi-greet for ${name}`
        },
        extra.sessionId
      );
      await sleep(1e3);
      await server.sendLoggingMessage(
        {
          level: "info",
          data: `Sending first greeting to ${name}`
        },
        extra.sessionId
      );
      await sleep(1e3);
      await server.sendLoggingMessage(
        {
          level: "info",
          data: `Sending second greeting to ${name}`
        },
        extra.sessionId
      );
      return {
        content: [
          {
            type: "text",
            text: `Good morning, ${name}!`
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
app.post("/mcp", async (req, res) => {
  console.log("Received MCP request:", req.body);
  try {
    const sessionId = req.headers["mcp-session-id"];
    let transport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        // Enable JSON response mode
        onsessioninitialized: (sessionId2) => {
          console.log(`Session initialized with ID: ${sessionId2}`);
          transports[sessionId2] = transport;
        }
      });
      const server = getServer();
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
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});
const PORT = 3e3;
app.listen(PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`MCP Streamable HTTP Server listening on port ${PORT}`);
});
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  process.exit(0);
});
//# sourceMappingURL=jsonResponseStreamableHttp.js.map
