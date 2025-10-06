#!/usr/bin/env node
"use strict";
const mcp = require("../../server/mcp.js");
const stdio = require("../../server/stdio.js");
const zod = require("zod");
const server = new mcp.McpServer({
  name: "mcp-output-schema-high-level-example",
  version: "1.0.0"
});
server.registerTool(
  "get_weather",
  {
    description: "Get weather information for a city",
    inputSchema: {
      city: zod.z.string().describe("City name"),
      country: zod.z.string().describe("Country code (e.g., US, UK)")
    },
    outputSchema: {
      temperature: zod.z.object({
        celsius: zod.z.number(),
        fahrenheit: zod.z.number()
      }),
      conditions: zod.z.enum(["sunny", "cloudy", "rainy", "stormy", "snowy"]),
      humidity: zod.z.number().min(0).max(100),
      wind: zod.z.object({
        speed_kmh: zod.z.number(),
        direction: zod.z.string()
      })
    }
  },
  async ({ city, country }) => {
    const temp_c = Math.round((Math.random() * 35 - 5) * 10) / 10;
    const conditions = ["sunny", "cloudy", "rainy", "stormy", "snowy"][Math.floor(Math.random() * 5)];
    const structuredContent = {
      temperature: {
        celsius: temp_c,
        fahrenheit: Math.round((temp_c * 9 / 5 + 32) * 10) / 10
      },
      conditions,
      humidity: Math.round(Math.random() * 100),
      wind: {
        speed_kmh: Math.round(Math.random() * 50),
        direction: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.floor(Math.random() * 8)]
      }
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(structuredContent, null, 2)
        }
      ],
      structuredContent
    };
  }
);
async function main() {
  const transport = new stdio.StdioServerTransport();
  await server.connect(transport);
  console.error("High-level Output Schema Example Server running on stdio");
}
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
//# sourceMappingURL=mcpServerOutputSchema.js.map
