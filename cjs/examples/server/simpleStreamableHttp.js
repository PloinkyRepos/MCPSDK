"use strict";
const express = require("express");
const crypto = require("node:crypto");
const zod = require("zod");
const mcp = require("../../server/mcp.js");
const streamableHttp = require("../../server/streamableHttp.js");
const router = require("../../server/auth/router.js");
const bearerAuth = require("../../server/auth/middleware/bearerAuth.js");
const types = require("../../types.js");
const inMemoryEventStore = require("../shared/inMemoryEventStore.js");
const demoInMemoryOAuthProvider = require("./demoInMemoryOAuthProvider.js");
const authUtils = require("../../shared/auth-utils.js");
const cors = require("cors");
var define_process_env_default = {};
const useOAuth = process.argv.includes("--oauth");
const strictOAuth = process.argv.includes("--oauth-strict");
const getServer = () => {
  const server = new mcp.McpServer(
    {
      name: "simple-streamable-http-server",
      version: "1.0.0",
      icons: [{ src: "./mcp.svg", sizes: ["512x512"], mimeType: "image/svg+xml" }],
      websiteUrl: "https://github.com/modelcontextprotocol/typescript-sdk"
    },
    { capabilities: { logging: {} } }
  );
  server.registerTool(
    "greet",
    {
      title: "Greeting Tool",
      // Display name for UI
      description: "A simple greeting tool",
      inputSchema: {
        name: zod.z.string().describe("Name to greet")
      }
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
      name: zod.z.string().describe("Name to greet")
    },
    {
      title: "Multiple Greeting Tool",
      readOnlyHint: true,
      openWorldHint: false
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
  server.tool(
    "collect-user-info",
    "A tool that collects user information through elicitation",
    {
      infoType: zod.z.enum(["contact", "preferences", "feedback"]).describe("Type of information to collect")
    },
    async ({ infoType }) => {
      let message;
      let requestedSchema;
      switch (infoType) {
        case "contact":
          message = "Please provide your contact information";
          requestedSchema = {
            type: "object",
            properties: {
              name: {
                type: "string",
                title: "Full Name",
                description: "Your full name"
              },
              email: {
                type: "string",
                title: "Email Address",
                description: "Your email address",
                format: "email"
              },
              phone: {
                type: "string",
                title: "Phone Number",
                description: "Your phone number (optional)"
              }
            },
            required: ["name", "email"]
          };
          break;
        case "preferences":
          message = "Please set your preferences";
          requestedSchema = {
            type: "object",
            properties: {
              theme: {
                type: "string",
                title: "Theme",
                description: "Choose your preferred theme",
                enum: ["light", "dark", "auto"],
                enumNames: ["Light", "Dark", "Auto"]
              },
              notifications: {
                type: "boolean",
                title: "Enable Notifications",
                description: "Would you like to receive notifications?",
                default: true
              },
              frequency: {
                type: "string",
                title: "Notification Frequency",
                description: "How often would you like notifications?",
                enum: ["daily", "weekly", "monthly"],
                enumNames: ["Daily", "Weekly", "Monthly"]
              }
            },
            required: ["theme"]
          };
          break;
        case "feedback":
          message = "Please provide your feedback";
          requestedSchema = {
            type: "object",
            properties: {
              rating: {
                type: "integer",
                title: "Rating",
                description: "Rate your experience (1-5)",
                minimum: 1,
                maximum: 5
              },
              comments: {
                type: "string",
                title: "Comments",
                description: "Additional comments (optional)",
                maxLength: 500
              },
              recommend: {
                type: "boolean",
                title: "Would you recommend this?",
                description: "Would you recommend this to others?"
              }
            },
            required: ["rating", "recommend"]
          };
          break;
        default:
          throw new Error(`Unknown info type: ${infoType}`);
      }
      try {
        const result = await server.server.elicitInput({
          message,
          requestedSchema
        });
        if (result.action === "accept") {
          return {
            content: [
              {
                type: "text",
                text: `Thank you! Collected ${infoType} information: ${JSON.stringify(result.content, null, 2)}`
              }
            ]
          };
        } else if (result.action === "decline") {
          return {
            content: [
              {
                type: "text",
                text: `No information was collected. User declined ${infoType} information request.`
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Information collection was cancelled by the user.`
              }
            ]
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error collecting ${infoType} information: ${error}`
            }
          ]
        };
      }
    }
  );
  server.registerPrompt(
    "greeting-template",
    {
      title: "Greeting Template",
      // Display name for UI
      description: "A simple greeting prompt template",
      argsSchema: {
        name: zod.z.string().describe("Name to include in greeting")
      }
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
  server.registerResource(
    "greeting-resource",
    "https://example.com/greetings/default",
    {
      title: "Default Greeting",
      // Display name for UI
      description: "A simple greeting resource",
      mimeType: "text/plain"
    },
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
  server.registerResource(
    "example-file-1",
    "file:///example/file1.txt",
    {
      title: "Example File 1",
      description: "First example file for ResourceLink demonstration",
      mimeType: "text/plain"
    },
    async () => {
      return {
        contents: [
          {
            uri: "file:///example/file1.txt",
            text: "This is the content of file 1"
          }
        ]
      };
    }
  );
  server.registerResource(
    "example-file-2",
    "file:///example/file2.txt",
    {
      title: "Example File 2",
      description: "Second example file for ResourceLink demonstration",
      mimeType: "text/plain"
    },
    async () => {
      return {
        contents: [
          {
            uri: "file:///example/file2.txt",
            text: "This is the content of file 2"
          }
        ]
      };
    }
  );
  server.registerTool(
    "list-files",
    {
      title: "List Files with ResourceLinks",
      description: "Returns a list of files as ResourceLinks without embedding their content",
      inputSchema: {
        includeDescriptions: zod.z.boolean().optional().describe("Whether to include descriptions in the resource links")
      }
    },
    async ({ includeDescriptions = true }) => {
      const resourceLinks = [
        {
          type: "resource_link",
          uri: "https://example.com/greetings/default",
          name: "Default Greeting",
          mimeType: "text/plain",
          ...includeDescriptions && { description: "A simple greeting resource" }
        },
        {
          type: "resource_link",
          uri: "file:///example/file1.txt",
          name: "Example File 1",
          mimeType: "text/plain",
          ...includeDescriptions && { description: "First example file for ResourceLink demonstration" }
        },
        {
          type: "resource_link",
          uri: "file:///example/file2.txt",
          name: "Example File 2",
          mimeType: "text/plain",
          ...includeDescriptions && { description: "Second example file for ResourceLink demonstration" }
        }
      ];
      return {
        content: [
          {
            type: "text",
            text: "Here are the available files as resource links:"
          },
          ...resourceLinks,
          {
            type: "text",
            text: "\nYou can read any of these resources using their URI."
          }
        ]
      };
    }
  );
  return server;
};
const MCP_PORT = define_process_env_default.MCP_PORT ? parseInt(define_process_env_default.MCP_PORT, 10) : 3e3;
const AUTH_PORT = define_process_env_default.MCP_AUTH_PORT ? parseInt(define_process_env_default.MCP_AUTH_PORT, 10) : 3001;
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
    // Allow all origins
    exposedHeaders: ["Mcp-Session-Id"]
  })
);
let authMiddleware = null;
if (useOAuth) {
  const mcpServerUrl = new URL(`http://localhost:${MCP_PORT}/mcp`);
  const authServerUrl = new URL(`http://localhost:${AUTH_PORT}`);
  const oauthMetadata = demoInMemoryOAuthProvider.setupAuthServer({ authServerUrl, mcpServerUrl, strictResource: strictOAuth });
  const tokenVerifier = {
    verifyAccessToken: async (token) => {
      const endpoint = oauthMetadata.introspection_endpoint;
      if (!endpoint) {
        throw new Error("No token verification endpoint available in metadata");
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          token
        }).toString()
      });
      if (!response.ok) {
        throw new Error(`Invalid or expired token: ${await response.text()}`);
      }
      const data = await response.json();
      if (strictOAuth) {
        if (!data.aud) {
          throw new Error(`Resource Indicator (RFC8707) missing`);
        }
        if (!authUtils.checkResourceAllowed({ requestedResource: data.aud, configuredResource: mcpServerUrl })) {
          throw new Error(`Expected resource indicator ${mcpServerUrl}, got: ${data.aud}`);
        }
      }
      return {
        token,
        clientId: data.client_id,
        scopes: data.scope ? data.scope.split(" ") : [],
        expiresAt: data.exp
      };
    }
  };
  app.use(
    router.mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: mcpServerUrl,
      scopesSupported: ["mcp:tools"],
      resourceName: "MCP Demo Server"
    })
  );
  authMiddleware = bearerAuth.requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes: [],
    resourceMetadataUrl: router.getOAuthProtectedResourceMetadataUrl(mcpServerUrl)
  });
}
const transports = {};
const mcpPostHandler = async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId) {
    console.log(`Received MCP request for session: ${sessionId}`);
  } else {
    console.log("Request body:", req.body);
  }
  if (useOAuth && req.auth) {
    console.log("Authenticated user:", req.auth);
  }
  try {
    let transport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && types.isInitializeRequest(req.body)) {
      const eventStore = new inMemoryEventStore.InMemoryEventStore();
      transport = new streamableHttp.StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        eventStore,
        // Enable resumability
        onsessioninitialized: (sessionId2) => {
          console.log(`Session initialized with ID: ${sessionId2}`);
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
};
if (useOAuth && authMiddleware) {
  app.post("/mcp", authMiddleware, mcpPostHandler);
} else {
  app.post("/mcp", mcpPostHandler);
}
const mcpGetHandler = async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  if (useOAuth && req.auth) {
    console.log("Authenticated SSE connection from user:", req.auth);
  }
  const lastEventId = req.headers["last-event-id"];
  if (lastEventId) {
    console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
  } else {
    console.log(`Establishing new SSE stream for session ${sessionId}`);
  }
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};
if (useOAuth && authMiddleware) {
  app.get("/mcp", authMiddleware, mcpGetHandler);
} else {
  app.get("/mcp", mcpGetHandler);
}
const mcpDeleteHandler = async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  console.log(`Received session termination request for session ${sessionId}`);
  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
};
if (useOAuth && authMiddleware) {
  app.delete("/mcp", authMiddleware, mcpDeleteHandler);
} else {
  app.delete("/mcp", mcpDeleteHandler);
}
app.listen(MCP_PORT, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`MCP Streamable HTTP Server listening on port ${MCP_PORT}`);
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
//# sourceMappingURL=simpleStreamableHttp.js.map
