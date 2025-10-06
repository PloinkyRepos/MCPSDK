import { McpServer } from "../../server/mcp.js";
import { StdioServerTransport } from "../../server/stdio.js";
import { z } from "zod";
const mcpServer = new McpServer({
  name: "tools-with-sample-server",
  version: "1.0.0"
});
mcpServer.registerTool(
  "summarize",
  {
    description: "Summarize any text using an LLM",
    inputSchema: {
      text: z.string().describe("Text to summarize")
    }
  },
  async ({ text }) => {
    const response = await mcpServer.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please summarize the following text concisely:

${text}`
          }
        }
      ],
      maxTokens: 500
    });
    return {
      content: [
        {
          type: "text",
          text: response.content.type === "text" ? response.content.text : "Unable to generate summary"
        }
      ]
    };
  }
);
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log("MCP server is running...");
}
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
//# sourceMappingURL=toolWithSampleServer.js.map
