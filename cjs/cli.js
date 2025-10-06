"use strict";
const browser = require("./node_modules/ws/browser.js");
const express = require("express");
const index = require("./client/index.js");
const sse = require("./client/sse.js");
const stdio = require("./client/stdio.js");
const websocket = require("./client/websocket.js");
const index$1 = require("./server/index.js");
const sse$1 = require("./server/sse.js");
const stdio$1 = require("./server/stdio.js");
const types = require("./types.js");
global.WebSocket = browser;
async function runClient(url_or_command, args2) {
  const client = new index.Client(
    {
      name: "mcp-typescript test client",
      version: "0.1.0"
    },
    {
      capabilities: {
        sampling: {}
      }
    }
  );
  let clientTransport;
  let url = void 0;
  try {
    url = new URL(url_or_command);
  } catch {
  }
  if (url?.protocol === "http:" || url?.protocol === "https:") {
    clientTransport = new sse.SSEClientTransport(new URL(url_or_command));
  } else if (url?.protocol === "ws:" || url?.protocol === "wss:") {
    clientTransport = new websocket.WebSocketClientTransport(new URL(url_or_command));
  } else {
    clientTransport = new stdio.StdioClientTransport({
      command: url_or_command,
      args: args2
    });
  }
  console.log("Connected to server.");
  await client.connect(clientTransport);
  console.log("Initialized.");
  await client.request({ method: "resources/list" }, types.ListResourcesResultSchema);
  await client.close();
  console.log("Closed.");
}
async function runServer(port) {
  if (port !== null) {
    const app = express();
    let servers = [];
    app.get("/sse", async (req, res) => {
      console.log("Got new SSE connection");
      const transport = new sse$1.SSEServerTransport("/message", res);
      const server = new index$1.Server(
        {
          name: "mcp-typescript test server",
          version: "0.1.0"
        },
        {
          capabilities: {}
        }
      );
      servers.push(server);
      server.onclose = () => {
        console.log("SSE connection closed");
        servers = servers.filter((s) => s !== server);
      };
      await server.connect(transport);
    });
    app.post("/message", async (req, res) => {
      console.log("Received message");
      const sessionId = req.query.sessionId;
      const transport = servers.map((s) => s.transport).find((t) => t.sessionId === sessionId);
      if (!transport) {
        res.status(404).send("Session not found");
        return;
      }
      await transport.handlePostMessage(req, res);
    });
    app.listen(port, (error) => {
      if (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
      }
      console.log(`Server running on http://localhost:${port}/sse`);
    });
  } else {
    const server = new index$1.Server(
      {
        name: "mcp-typescript test server",
        version: "0.1.0"
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
          logging: {}
        }
      }
    );
    const transport = new stdio$1.StdioServerTransport();
    await server.connect(transport);
    console.log("Server running on stdio");
  }
}
const args = process.argv.slice(2);
const command = args[0];
switch (command) {
  case "client":
    if (args.length < 2) {
      console.error("Usage: client <server_url_or_command> [args...]");
      process.exit(1);
    }
    runClient(args[1], args.slice(2)).catch((error) => {
      console.error(error);
      process.exit(1);
    });
    break;
  case "server": {
    const port = args[1] ? parseInt(args[1]) : null;
    runServer(port).catch((error) => {
      console.error(error);
      process.exit(1);
    });
    break;
  }
  default:
    console.error("Unrecognized command:", command);
}
//# sourceMappingURL=cli.js.map
