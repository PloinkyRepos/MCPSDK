import { Client } from "../../client/index.js";
import { StreamableHTTPClientTransport } from "../../client/streamableHttp.js";
import { LoggingMessageNotificationSchema, ListToolsResultSchema, CallToolResultSchema } from "../../types.js";
const args = process.argv.slice(2);
const serverUrl = args[0] || "http://localhost:3000/mcp";
async function main() {
  console.log("MCP Parallel Tool Calls Client");
  console.log("==============================");
  console.log(`Connecting to server at: ${serverUrl}`);
  let client;
  let transport;
  try {
    client = new Client({
      name: "parallel-tool-calls-client",
      version: "1.0.0"
    });
    client.onerror = (error) => {
      console.error("Client error:", error);
    };
    transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    await client.connect(transport);
    console.log("Successfully connected to MCP server");
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      console.log(`Notification: ${notification.params.data}`);
    });
    console.log("List tools");
    const toolsRequest = await listTools(client);
    console.log("Tools: ", toolsRequest);
    console.log("\n=== Starting Multiple Notification Streams in Parallel ===");
    const toolResults = await startParallelNotificationTools(client);
    for (const [caller, result] of Object.entries(toolResults)) {
      console.log(`
=== Tool result for ${caller} ===`);
      result.content.forEach((item) => {
        if (item.type === "text") {
          console.log(`  ${item.text}`);
        } else {
          console.log(`  ${item.type} content:`, item);
        }
      });
    }
    console.log("\n=== Waiting for all notifications ===");
    await new Promise((resolve) => setTimeout(resolve, 1e4));
    console.log("\n=== Disconnecting ===");
    await transport.close();
    console.log("Disconnected from MCP server");
  } catch (error) {
    console.error("Error running client:", error);
    process.exit(1);
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
async function startParallelNotificationTools(client) {
  try {
    const toolCalls = [
      {
        caller: "fast-notifier",
        request: {
          method: "tools/call",
          params: {
            name: "start-notification-stream",
            arguments: {
              interval: 2,
              // 0.5 second between notifications
              count: 10,
              // Send 10 notifications
              caller: "fast-notifier"
              // Identify this tool call
            }
          }
        }
      },
      {
        caller: "slow-notifier",
        request: {
          method: "tools/call",
          params: {
            name: "start-notification-stream",
            arguments: {
              interval: 5,
              // 2 seconds between notifications
              count: 5,
              // Send 5 notifications
              caller: "slow-notifier"
              // Identify this tool call
            }
          }
        }
      },
      {
        caller: "burst-notifier",
        request: {
          method: "tools/call",
          params: {
            name: "start-notification-stream",
            arguments: {
              interval: 1,
              // 0.1 second between notifications
              count: 3,
              // Send just 3 notifications
              caller: "burst-notifier"
              // Identify this tool call
            }
          }
        }
      }
    ];
    console.log(`Starting ${toolCalls.length} notification tools in parallel...`);
    const toolPromises = toolCalls.map(({ caller, request }) => {
      console.log(`Starting tool call for ${caller}...`);
      return client.request(request, CallToolResultSchema).then((result) => ({ caller, result })).catch((error) => {
        console.error(`Error in tool call for ${caller}:`, error);
        throw error;
      });
    });
    const results = await Promise.all(toolPromises);
    const resultsByTool = {};
    results.forEach(({ caller, result }) => {
      resultsByTool[caller] = result;
    });
    return resultsByTool;
  } catch (error) {
    console.error(`Error starting parallel notification tools:`, error);
    throw error;
  }
}
main().catch((error) => {
  console.error("Error running MCP client:", error);
  process.exit(1);
});
//# sourceMappingURL=parallelToolCallsClient.js.map
