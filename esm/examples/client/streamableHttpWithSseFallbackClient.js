import { Client } from "../../client/index.js";
import { StreamableHTTPClientTransport } from "../../client/streamableHttp.js";
import { SSEClientTransport } from "../../client/sse.js";
import { LoggingMessageNotificationSchema, ListToolsResultSchema, CallToolResultSchema } from "../../types.js";
const args = process.argv.slice(2);
const serverUrl = args[0] || "http://localhost:3000/mcp";
async function main() {
  console.log("MCP Backwards Compatible Client");
  console.log("===============================");
  console.log(`Connecting to server at: ${serverUrl}`);
  let client;
  let transport;
  try {
    const connection = await connectWithBackwardsCompatibility(serverUrl);
    client = connection.client;
    transport = connection.transport;
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      console.log(`Notification: ${notification.params.level} - ${notification.params.data}`);
    });
    console.log("\n=== Listing Available Tools ===");
    await listTools(client);
    console.log("\n=== Starting Notification Stream ===");
    await startNotificationTool(client);
    console.log("\n=== Waiting for all notifications ===");
    await new Promise((resolve) => setTimeout(resolve, 5e3));
    console.log("\n=== Disconnecting ===");
    await transport.close();
    console.log("Disconnected from MCP server");
  } catch (error) {
    console.error("Error running client:", error);
    process.exit(1);
  }
}
async function connectWithBackwardsCompatibility(url) {
  console.log("1. Trying Streamable HTTP transport first...");
  const client = new Client({
    name: "backwards-compatible-client",
    version: "1.0.0"
  });
  client.onerror = (error) => {
    console.error("Client error:", error);
  };
  const baseUrl = new URL(url);
  try {
    const streamableTransport = new StreamableHTTPClientTransport(baseUrl);
    await client.connect(streamableTransport);
    console.log("Successfully connected using modern Streamable HTTP transport.");
    return {
      client,
      transport: streamableTransport,
      transportType: "streamable-http"
    };
  } catch (error) {
    console.log(`StreamableHttp transport connection failed: ${error}`);
    console.log("2. Falling back to deprecated HTTP+SSE transport...");
    try {
      const sseTransport = new SSEClientTransport(baseUrl);
      const sseClient = new Client({
        name: "backwards-compatible-client",
        version: "1.0.0"
      });
      await sseClient.connect(sseTransport);
      console.log("Successfully connected using deprecated HTTP+SSE transport.");
      return {
        client: sseClient,
        transport: sseTransport,
        transportType: "sse"
      };
    } catch (sseError) {
      console.error(`Failed to connect with either transport method:
1. Streamable HTTP error: ${error}
2. SSE error: ${sseError}`);
      throw new Error("Could not connect to server with any available transport");
    }
  }
}
async function listTools(client) {
  try {
    const toolsRequest = {
      method: "tools/list",
      params: {}
    };
    const toolsResult = await client.request(toolsRequest, ListToolsResultSchema);
    console.log("Available tools:");
    if (toolsResult.tools.length === 0) {
      console.log("  No tools available");
    } else {
      for (const tool of toolsResult.tools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }
  } catch (error) {
    console.log(`Tools not supported by this server: ${error}`);
  }
}
async function startNotificationTool(client) {
  try {
    const request = {
      method: "tools/call",
      params: {
        name: "start-notification-stream",
        arguments: {
          interval: 1e3,
          // 1 second between notifications
          count: 5
          // Send 5 notifications
        }
      }
    };
    console.log("Calling notification tool...");
    const result = await client.request(request, CallToolResultSchema);
    console.log("Tool result:");
    result.content.forEach((item) => {
      if (item.type === "text") {
        console.log(`  ${item.text}`);
      } else {
        console.log(`  ${item.type} content:`, item);
      }
    });
  } catch (error) {
    console.log(`Error calling notification tool: ${error}`);
  }
}
main().catch((error) => {
  console.error("Error running MCP client:", error);
  process.exit(1);
});
//# sourceMappingURL=streamableHttpWithSseFallbackClient.js.map
