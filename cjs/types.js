"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const zod = require("zod");
const LATEST_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-03-26", "2024-11-05", "2024-10-07"];
const JSONRPC_VERSION = "2.0";
const ProgressTokenSchema = zod.z.union([zod.z.string(), zod.z.number().int()]);
const CursorSchema = zod.z.string();
const RequestMetaSchema = zod.z.object({
  /**
   * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
   */
  progressToken: zod.z.optional(ProgressTokenSchema)
}).passthrough();
const BaseRequestParamsSchema = zod.z.object({
  _meta: zod.z.optional(RequestMetaSchema)
}).passthrough();
const RequestSchema = zod.z.object({
  method: zod.z.string(),
  params: zod.z.optional(BaseRequestParamsSchema)
});
const BaseNotificationParamsSchema = zod.z.object({
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).passthrough();
const NotificationSchema = zod.z.object({
  method: zod.z.string(),
  params: zod.z.optional(BaseNotificationParamsSchema)
});
const ResultSchema = zod.z.object({
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).passthrough();
const RequestIdSchema = zod.z.union([zod.z.string(), zod.z.number().int()]);
const JSONRPCRequestSchema = zod.z.object({
  jsonrpc: zod.z.literal(JSONRPC_VERSION),
  id: RequestIdSchema
}).merge(RequestSchema).strict();
const isJSONRPCRequest = (value) => JSONRPCRequestSchema.safeParse(value).success;
const JSONRPCNotificationSchema = zod.z.object({
  jsonrpc: zod.z.literal(JSONRPC_VERSION)
}).merge(NotificationSchema).strict();
const isJSONRPCNotification = (value) => JSONRPCNotificationSchema.safeParse(value).success;
const JSONRPCResponseSchema = zod.z.object({
  jsonrpc: zod.z.literal(JSONRPC_VERSION),
  id: RequestIdSchema,
  result: ResultSchema
}).strict();
const isJSONRPCResponse = (value) => JSONRPCResponseSchema.safeParse(value).success;
var ErrorCode = /* @__PURE__ */ ((ErrorCode2) => {
  ErrorCode2[ErrorCode2["ConnectionClosed"] = -32e3] = "ConnectionClosed";
  ErrorCode2[ErrorCode2["RequestTimeout"] = -32001] = "RequestTimeout";
  ErrorCode2[ErrorCode2["ParseError"] = -32700] = "ParseError";
  ErrorCode2[ErrorCode2["InvalidRequest"] = -32600] = "InvalidRequest";
  ErrorCode2[ErrorCode2["MethodNotFound"] = -32601] = "MethodNotFound";
  ErrorCode2[ErrorCode2["InvalidParams"] = -32602] = "InvalidParams";
  ErrorCode2[ErrorCode2["InternalError"] = -32603] = "InternalError";
  return ErrorCode2;
})(ErrorCode || {});
const JSONRPCErrorSchema = zod.z.object({
  jsonrpc: zod.z.literal(JSONRPC_VERSION),
  id: RequestIdSchema,
  error: zod.z.object({
    /**
     * The error type that occurred.
     */
    code: zod.z.number().int(),
    /**
     * A short description of the error. The message SHOULD be limited to a concise single sentence.
     */
    message: zod.z.string(),
    /**
     * Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
     */
    data: zod.z.optional(zod.z.unknown())
  })
}).strict();
const isJSONRPCError = (value) => JSONRPCErrorSchema.safeParse(value).success;
const JSONRPCMessageSchema = zod.z.union([JSONRPCRequestSchema, JSONRPCNotificationSchema, JSONRPCResponseSchema, JSONRPCErrorSchema]);
const EmptyResultSchema = ResultSchema.strict();
const CancelledNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/cancelled"),
  params: BaseNotificationParamsSchema.extend({
    /**
     * The ID of the request to cancel.
     *
     * This MUST correspond to the ID of a request previously issued in the same direction.
     */
    requestId: RequestIdSchema,
    /**
     * An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
     */
    reason: zod.z.string().optional()
  })
});
const IconSchema = zod.z.object({
  /**
   * URL or data URI for the icon.
   */
  src: zod.z.string(),
  /**
   * Optional MIME type for the icon.
   */
  mimeType: zod.z.optional(zod.z.string()),
  /**
   * Optional array of strings that specify sizes at which the icon can be used.
   * Each string should be in WxH format (e.g., `"48x48"`, `"96x96"`) or `"any"` for scalable formats like SVG.
   *
   * If not provided, the client should assume that the icon can be used at any size.
   */
  sizes: zod.z.optional(zod.z.array(zod.z.string()))
}).passthrough();
const IconsSchema = zod.z.object({
  /**
   * Optional set of sized icons that the client can display in a user interface.
   *
   * Clients that support rendering icons MUST support at least the following MIME types:
   * - `image/png` - PNG images (safe, universal compatibility)
   * - `image/jpeg` (and `image/jpg`) - JPEG images (safe, universal compatibility)
   *
   * Clients that support rendering icons SHOULD also support:
   * - `image/svg+xml` - SVG images (scalable but requires security precautions)
   * - `image/webp` - WebP images (modern, efficient format)
   */
  icons: zod.z.array(IconSchema).optional()
}).passthrough();
const BaseMetadataSchema = zod.z.object({
  /** Intended for programmatic or logical use, but used as a display name in past specs or fallback */
  name: zod.z.string(),
  /**
   * Intended for UI and end-user contexts — optimized to be human-readable and easily understood,
   * even by those unfamiliar with domain-specific terminology.
   *
   * If not provided, the name should be used for display (except for Tool,
   * where `annotations.title` should be given precedence over using `name`,
   * if present).
   */
  title: zod.z.optional(zod.z.string())
}).passthrough();
const ImplementationSchema = BaseMetadataSchema.extend({
  version: zod.z.string(),
  /**
   * An optional URL of the website for this implementation.
   */
  websiteUrl: zod.z.optional(zod.z.string())
}).merge(IconsSchema);
const ClientCapabilitiesSchema = zod.z.object({
  /**
   * Experimental, non-standard capabilities that the client supports.
   */
  experimental: zod.z.optional(zod.z.object({}).passthrough()),
  /**
   * Present if the client supports sampling from an LLM.
   */
  sampling: zod.z.optional(zod.z.object({}).passthrough()),
  /**
   * Present if the client supports eliciting user input.
   */
  elicitation: zod.z.optional(zod.z.object({}).passthrough()),
  /**
   * Present if the client supports listing roots.
   */
  roots: zod.z.optional(
    zod.z.object({
      /**
       * Whether the client supports issuing notifications for changes to the roots list.
       */
      listChanged: zod.z.optional(zod.z.boolean())
    }).passthrough()
  )
}).passthrough();
const InitializeRequestSchema = RequestSchema.extend({
  method: zod.z.literal("initialize"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
     */
    protocolVersion: zod.z.string(),
    capabilities: ClientCapabilitiesSchema,
    clientInfo: ImplementationSchema
  })
});
const isInitializeRequest = (value) => InitializeRequestSchema.safeParse(value).success;
const ServerCapabilitiesSchema = zod.z.object({
  /**
   * Experimental, non-standard capabilities that the server supports.
   */
  experimental: zod.z.optional(zod.z.object({}).passthrough()),
  /**
   * Present if the server supports sending log messages to the client.
   */
  logging: zod.z.optional(zod.z.object({}).passthrough()),
  /**
   * Present if the server supports sending completions to the client.
   */
  completions: zod.z.optional(zod.z.object({}).passthrough()),
  /**
   * Present if the server offers any prompt templates.
   */
  prompts: zod.z.optional(
    zod.z.object({
      /**
       * Whether this server supports issuing notifications for changes to the prompt list.
       */
      listChanged: zod.z.optional(zod.z.boolean())
    }).passthrough()
  ),
  /**
   * Present if the server offers any resources to read.
   */
  resources: zod.z.optional(
    zod.z.object({
      /**
       * Whether this server supports clients subscribing to resource updates.
       */
      subscribe: zod.z.optional(zod.z.boolean()),
      /**
       * Whether this server supports issuing notifications for changes to the resource list.
       */
      listChanged: zod.z.optional(zod.z.boolean())
    }).passthrough()
  ),
  /**
   * Present if the server offers any tools to call.
   */
  tools: zod.z.optional(
    zod.z.object({
      /**
       * Whether this server supports issuing notifications for changes to the tool list.
       */
      listChanged: zod.z.optional(zod.z.boolean())
    }).passthrough()
  )
}).passthrough();
const InitializeResultSchema = ResultSchema.extend({
  /**
   * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
   */
  protocolVersion: zod.z.string(),
  capabilities: ServerCapabilitiesSchema,
  serverInfo: ImplementationSchema,
  /**
   * Instructions describing how to use the server and its features.
   *
   * This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
   */
  instructions: zod.z.optional(zod.z.string())
});
const InitializedNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/initialized")
});
const isInitializedNotification = (value) => InitializedNotificationSchema.safeParse(value).success;
const PingRequestSchema = RequestSchema.extend({
  method: zod.z.literal("ping")
});
const ProgressSchema = zod.z.object({
  /**
   * The progress thus far. This should increase every time progress is made, even if the total is unknown.
   */
  progress: zod.z.number(),
  /**
   * Total number of items to process (or total progress required), if known.
   */
  total: zod.z.optional(zod.z.number()),
  /**
   * An optional message describing the current progress.
   */
  message: zod.z.optional(zod.z.string())
}).passthrough();
const ProgressNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/progress"),
  params: BaseNotificationParamsSchema.merge(ProgressSchema).extend({
    /**
     * The progress token which was given in the initial request, used to associate this notification with the request that is proceeding.
     */
    progressToken: ProgressTokenSchema
  })
});
const PaginatedRequestSchema = RequestSchema.extend({
  params: BaseRequestParamsSchema.extend({
    /**
     * An opaque token representing the current pagination position.
     * If provided, the server should return results starting after this cursor.
     */
    cursor: zod.z.optional(CursorSchema)
  }).optional()
});
const PaginatedResultSchema = ResultSchema.extend({
  /**
   * An opaque token representing the pagination position after the last returned result.
   * If present, there may be more results available.
   */
  nextCursor: zod.z.optional(CursorSchema)
});
const ResourceContentsSchema = zod.z.object({
  /**
   * The URI of this resource.
   */
  uri: zod.z.string(),
  /**
   * The MIME type of this resource, if known.
   */
  mimeType: zod.z.optional(zod.z.string()),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).passthrough();
const TextResourceContentsSchema = ResourceContentsSchema.extend({
  /**
   * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
   */
  text: zod.z.string()
});
const Base64Schema = zod.z.string().refine(
  (val) => {
    try {
      atob(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid Base64 string" }
);
const BlobResourceContentsSchema = ResourceContentsSchema.extend({
  /**
   * A base64-encoded string representing the binary data of the item.
   */
  blob: Base64Schema
});
const ResourceSchema = BaseMetadataSchema.extend({
  /**
   * The URI of this resource.
   */
  uri: zod.z.string(),
  /**
   * A description of what this resource represents.
   *
   * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
   */
  description: zod.z.optional(zod.z.string()),
  /**
   * The MIME type of this resource, if known.
   */
  mimeType: zod.z.optional(zod.z.string()),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).merge(IconsSchema);
const ResourceTemplateSchema = BaseMetadataSchema.extend({
  /**
   * A URI template (according to RFC 6570) that can be used to construct resource URIs.
   */
  uriTemplate: zod.z.string(),
  /**
   * A description of what this template is for.
   *
   * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
   */
  description: zod.z.optional(zod.z.string()),
  /**
   * The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
   */
  mimeType: zod.z.optional(zod.z.string()),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).merge(IconsSchema);
const ListResourcesRequestSchema = PaginatedRequestSchema.extend({
  method: zod.z.literal("resources/list")
});
const ListResourcesResultSchema = PaginatedResultSchema.extend({
  resources: zod.z.array(ResourceSchema)
});
const ListResourceTemplatesRequestSchema = PaginatedRequestSchema.extend({
  method: zod.z.literal("resources/templates/list")
});
const ListResourceTemplatesResultSchema = PaginatedResultSchema.extend({
  resourceTemplates: zod.z.array(ResourceTemplateSchema)
});
const ReadResourceRequestSchema = RequestSchema.extend({
  method: zod.z.literal("resources/read"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.
     */
    uri: zod.z.string()
  })
});
const ReadResourceResultSchema = ResultSchema.extend({
  contents: zod.z.array(zod.z.union([TextResourceContentsSchema, BlobResourceContentsSchema]))
});
const ResourceListChangedNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/resources/list_changed")
});
const SubscribeRequestSchema = RequestSchema.extend({
  method: zod.z.literal("resources/subscribe"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.
     */
    uri: zod.z.string()
  })
});
const UnsubscribeRequestSchema = RequestSchema.extend({
  method: zod.z.literal("resources/unsubscribe"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The URI of the resource to unsubscribe from.
     */
    uri: zod.z.string()
  })
});
const ResourceUpdatedNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/resources/updated"),
  params: BaseNotificationParamsSchema.extend({
    /**
     * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
     */
    uri: zod.z.string()
  })
});
const PromptArgumentSchema = zod.z.object({
  /**
   * The name of the argument.
   */
  name: zod.z.string(),
  /**
   * A human-readable description of the argument.
   */
  description: zod.z.optional(zod.z.string()),
  /**
   * Whether this argument must be provided.
   */
  required: zod.z.optional(zod.z.boolean())
}).passthrough();
const PromptSchema = BaseMetadataSchema.extend({
  /**
   * An optional description of what this prompt provides
   */
  description: zod.z.optional(zod.z.string()),
  /**
   * A list of arguments to use for templating the prompt.
   */
  arguments: zod.z.optional(zod.z.array(PromptArgumentSchema)),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).merge(IconsSchema);
const ListPromptsRequestSchema = PaginatedRequestSchema.extend({
  method: zod.z.literal("prompts/list")
});
const ListPromptsResultSchema = PaginatedResultSchema.extend({
  prompts: zod.z.array(PromptSchema)
});
const GetPromptRequestSchema = RequestSchema.extend({
  method: zod.z.literal("prompts/get"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The name of the prompt or prompt template.
     */
    name: zod.z.string(),
    /**
     * Arguments to use for templating the prompt.
     */
    arguments: zod.z.optional(zod.z.record(zod.z.string()))
  })
});
const TextContentSchema = zod.z.object({
  type: zod.z.literal("text"),
  /**
   * The text content of the message.
   */
  text: zod.z.string(),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).passthrough();
const ImageContentSchema = zod.z.object({
  type: zod.z.literal("image"),
  /**
   * The base64-encoded image data.
   */
  data: Base64Schema,
  /**
   * The MIME type of the image. Different providers may support different image types.
   */
  mimeType: zod.z.string(),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).passthrough();
const AudioContentSchema = zod.z.object({
  type: zod.z.literal("audio"),
  /**
   * The base64-encoded audio data.
   */
  data: Base64Schema,
  /**
   * The MIME type of the audio. Different providers may support different audio types.
   */
  mimeType: zod.z.string(),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).passthrough();
const EmbeddedResourceSchema = zod.z.object({
  type: zod.z.literal("resource"),
  resource: zod.z.union([TextResourceContentsSchema, BlobResourceContentsSchema]),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).passthrough();
const ResourceLinkSchema = ResourceSchema.extend({
  type: zod.z.literal("resource_link")
});
const ContentBlockSchema = zod.z.union([
  TextContentSchema,
  ImageContentSchema,
  AudioContentSchema,
  ResourceLinkSchema,
  EmbeddedResourceSchema
]);
const PromptMessageSchema = zod.z.object({
  role: zod.z.enum(["user", "assistant"]),
  content: ContentBlockSchema
}).passthrough();
const GetPromptResultSchema = ResultSchema.extend({
  /**
   * An optional description for the prompt.
   */
  description: zod.z.optional(zod.z.string()),
  messages: zod.z.array(PromptMessageSchema)
});
const PromptListChangedNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/prompts/list_changed")
});
const ToolAnnotationsSchema = zod.z.object({
  /**
   * A human-readable title for the tool.
   */
  title: zod.z.optional(zod.z.string()),
  /**
   * If true, the tool does not modify its environment.
   *
   * Default: false
   */
  readOnlyHint: zod.z.optional(zod.z.boolean()),
  /**
   * If true, the tool may perform destructive updates to its environment.
   * If false, the tool performs only additive updates.
   *
   * (This property is meaningful only when `readOnlyHint == false`)
   *
   * Default: true
   */
  destructiveHint: zod.z.optional(zod.z.boolean()),
  /**
   * If true, calling the tool repeatedly with the same arguments
   * will have no additional effect on the its environment.
   *
   * (This property is meaningful only when `readOnlyHint == false`)
   *
   * Default: false
   */
  idempotentHint: zod.z.optional(zod.z.boolean()),
  /**
   * If true, this tool may interact with an "open world" of external
   * entities. If false, the tool's domain of interaction is closed.
   * For example, the world of a web search tool is open, whereas that
   * of a memory tool is not.
   *
   * Default: true
   */
  openWorldHint: zod.z.optional(zod.z.boolean())
}).passthrough();
const ToolSchema = BaseMetadataSchema.extend({
  /**
   * A human-readable description of the tool.
   */
  description: zod.z.optional(zod.z.string()),
  /**
   * A JSON Schema object defining the expected parameters for the tool.
   */
  inputSchema: zod.z.object({
    type: zod.z.literal("object"),
    properties: zod.z.optional(zod.z.object({}).passthrough()),
    required: zod.z.optional(zod.z.array(zod.z.string()))
  }).passthrough(),
  /**
   * An optional JSON Schema object defining the structure of the tool's output returned in
   * the structuredContent field of a CallToolResult.
   */
  outputSchema: zod.z.optional(
    zod.z.object({
      type: zod.z.literal("object"),
      properties: zod.z.optional(zod.z.object({}).passthrough()),
      required: zod.z.optional(zod.z.array(zod.z.string()))
    }).passthrough()
  ),
  /**
   * Optional additional tool information.
   */
  annotations: zod.z.optional(ToolAnnotationsSchema),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).merge(IconsSchema);
const ListToolsRequestSchema = PaginatedRequestSchema.extend({
  method: zod.z.literal("tools/list")
});
const ListToolsResultSchema = PaginatedResultSchema.extend({
  tools: zod.z.array(ToolSchema)
});
const CallToolResultSchema = ResultSchema.extend({
  /**
   * A list of content objects that represent the result of the tool call.
   *
   * If the Tool does not define an outputSchema, this field MUST be present in the result.
   * For backwards compatibility, this field is always present, but it may be empty.
   */
  content: zod.z.array(ContentBlockSchema).default([]),
  /**
   * An object containing structured tool output.
   *
   * If the Tool defines an outputSchema, this field MUST be present in the result, and contain a JSON object that matches the schema.
   */
  structuredContent: zod.z.object({}).passthrough().optional(),
  /**
   * Whether the tool call ended in an error.
   *
   * If not set, this is assumed to be false (the call was successful).
   *
   * Any errors that originate from the tool SHOULD be reported inside the result
   * object, with `isError` set to true, _not_ as an MCP protocol-level error
   * response. Otherwise, the LLM would not be able to see that an error occurred
   * and self-correct.
   *
   * However, any errors in _finding_ the tool, an error indicating that the
   * server does not support tool calls, or any other exceptional conditions,
   * should be reported as an MCP error response.
   */
  isError: zod.z.optional(zod.z.boolean())
});
const CompatibilityCallToolResultSchema = CallToolResultSchema.or(
  ResultSchema.extend({
    toolResult: zod.z.unknown()
  })
);
const CallToolRequestSchema = RequestSchema.extend({
  method: zod.z.literal("tools/call"),
  params: BaseRequestParamsSchema.extend({
    name: zod.z.string(),
    arguments: zod.z.optional(zod.z.record(zod.z.unknown()))
  })
});
const ToolListChangedNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/tools/list_changed")
});
const LoggingLevelSchema = zod.z.enum(["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"]);
const SetLevelRequestSchema = RequestSchema.extend({
  method: zod.z.literal("logging/setLevel"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/logging/message.
     */
    level: LoggingLevelSchema
  })
});
const LoggingMessageNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/message"),
  params: BaseNotificationParamsSchema.extend({
    /**
     * The severity of this log message.
     */
    level: LoggingLevelSchema,
    /**
     * An optional name of the logger issuing this message.
     */
    logger: zod.z.optional(zod.z.string()),
    /**
     * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
     */
    data: zod.z.unknown()
  })
});
const ModelHintSchema = zod.z.object({
  /**
   * A hint for a model name.
   */
  name: zod.z.string().optional()
}).passthrough();
const ModelPreferencesSchema = zod.z.object({
  /**
   * Optional hints to use for model selection.
   */
  hints: zod.z.optional(zod.z.array(ModelHintSchema)),
  /**
   * How much to prioritize cost when selecting a model.
   */
  costPriority: zod.z.optional(zod.z.number().min(0).max(1)),
  /**
   * How much to prioritize sampling speed (latency) when selecting a model.
   */
  speedPriority: zod.z.optional(zod.z.number().min(0).max(1)),
  /**
   * How much to prioritize intelligence and capabilities when selecting a model.
   */
  intelligencePriority: zod.z.optional(zod.z.number().min(0).max(1))
}).passthrough();
const SamplingMessageSchema = zod.z.object({
  role: zod.z.enum(["user", "assistant"]),
  content: zod.z.union([TextContentSchema, ImageContentSchema, AudioContentSchema])
}).passthrough();
const CreateMessageRequestSchema = RequestSchema.extend({
  method: zod.z.literal("sampling/createMessage"),
  params: BaseRequestParamsSchema.extend({
    messages: zod.z.array(SamplingMessageSchema),
    /**
     * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
     */
    systemPrompt: zod.z.optional(zod.z.string()),
    /**
     * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
     */
    includeContext: zod.z.optional(zod.z.enum(["none", "thisServer", "allServers"])),
    temperature: zod.z.optional(zod.z.number()),
    /**
     * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
     */
    maxTokens: zod.z.number().int(),
    stopSequences: zod.z.optional(zod.z.array(zod.z.string())),
    /**
     * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
     */
    metadata: zod.z.optional(zod.z.object({}).passthrough()),
    /**
     * The server's preferences for which model to select.
     */
    modelPreferences: zod.z.optional(ModelPreferencesSchema)
  })
});
const CreateMessageResultSchema = ResultSchema.extend({
  /**
   * The name of the model that generated the message.
   */
  model: zod.z.string(),
  /**
   * The reason why sampling stopped.
   */
  stopReason: zod.z.optional(zod.z.enum(["endTurn", "stopSequence", "maxTokens"]).or(zod.z.string())),
  role: zod.z.enum(["user", "assistant"]),
  content: zod.z.discriminatedUnion("type", [TextContentSchema, ImageContentSchema, AudioContentSchema])
});
const BooleanSchemaSchema = zod.z.object({
  type: zod.z.literal("boolean"),
  title: zod.z.optional(zod.z.string()),
  description: zod.z.optional(zod.z.string()),
  default: zod.z.optional(zod.z.boolean())
}).passthrough();
const StringSchemaSchema = zod.z.object({
  type: zod.z.literal("string"),
  title: zod.z.optional(zod.z.string()),
  description: zod.z.optional(zod.z.string()),
  minLength: zod.z.optional(zod.z.number()),
  maxLength: zod.z.optional(zod.z.number()),
  format: zod.z.optional(zod.z.enum(["email", "uri", "date", "date-time"]))
}).passthrough();
const NumberSchemaSchema = zod.z.object({
  type: zod.z.enum(["number", "integer"]),
  title: zod.z.optional(zod.z.string()),
  description: zod.z.optional(zod.z.string()),
  minimum: zod.z.optional(zod.z.number()),
  maximum: zod.z.optional(zod.z.number())
}).passthrough();
const EnumSchemaSchema = zod.z.object({
  type: zod.z.literal("string"),
  title: zod.z.optional(zod.z.string()),
  description: zod.z.optional(zod.z.string()),
  enum: zod.z.array(zod.z.string()),
  enumNames: zod.z.optional(zod.z.array(zod.z.string()))
}).passthrough();
const PrimitiveSchemaDefinitionSchema = zod.z.union([BooleanSchemaSchema, StringSchemaSchema, NumberSchemaSchema, EnumSchemaSchema]);
const ElicitRequestSchema = RequestSchema.extend({
  method: zod.z.literal("elicitation/create"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The message to present to the user.
     */
    message: zod.z.string(),
    /**
     * The schema for the requested user input.
     */
    requestedSchema: zod.z.object({
      type: zod.z.literal("object"),
      properties: zod.z.record(zod.z.string(), PrimitiveSchemaDefinitionSchema),
      required: zod.z.optional(zod.z.array(zod.z.string()))
    }).passthrough()
  })
});
const ElicitResultSchema = ResultSchema.extend({
  /**
   * The user's response action.
   */
  action: zod.z.enum(["accept", "decline", "cancel"]),
  /**
   * The collected user input content (only present if action is "accept").
   */
  content: zod.z.optional(zod.z.record(zod.z.string(), zod.z.unknown()))
});
const ResourceTemplateReferenceSchema = zod.z.object({
  type: zod.z.literal("ref/resource"),
  /**
   * The URI or URI template of the resource.
   */
  uri: zod.z.string()
}).passthrough();
const ResourceReferenceSchema = ResourceTemplateReferenceSchema;
const PromptReferenceSchema = zod.z.object({
  type: zod.z.literal("ref/prompt"),
  /**
   * The name of the prompt or prompt template
   */
  name: zod.z.string()
}).passthrough();
const CompleteRequestSchema = RequestSchema.extend({
  method: zod.z.literal("completion/complete"),
  params: BaseRequestParamsSchema.extend({
    ref: zod.z.union([PromptReferenceSchema, ResourceTemplateReferenceSchema]),
    /**
     * The argument's information
     */
    argument: zod.z.object({
      /**
       * The name of the argument
       */
      name: zod.z.string(),
      /**
       * The value of the argument to use for completion matching.
       */
      value: zod.z.string()
    }).passthrough(),
    context: zod.z.optional(
      zod.z.object({
        /**
         * Previously-resolved variables in a URI template or prompt.
         */
        arguments: zod.z.optional(zod.z.record(zod.z.string(), zod.z.string()))
      })
    )
  })
});
const CompleteResultSchema = ResultSchema.extend({
  completion: zod.z.object({
    /**
     * An array of completion values. Must not exceed 100 items.
     */
    values: zod.z.array(zod.z.string()).max(100),
    /**
     * The total number of completion options available. This can exceed the number of values actually sent in the response.
     */
    total: zod.z.optional(zod.z.number().int()),
    /**
     * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
     */
    hasMore: zod.z.optional(zod.z.boolean())
  }).passthrough()
});
const RootSchema = zod.z.object({
  /**
   * The URI identifying the root. This *must* start with file:// for now.
   */
  uri: zod.z.string().startsWith("file://"),
  /**
   * An optional name for the root.
   */
  name: zod.z.optional(zod.z.string()),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: zod.z.optional(zod.z.object({}).passthrough())
}).passthrough();
const ListRootsRequestSchema = RequestSchema.extend({
  method: zod.z.literal("roots/list")
});
const ListRootsResultSchema = ResultSchema.extend({
  roots: zod.z.array(RootSchema)
});
const RootsListChangedNotificationSchema = NotificationSchema.extend({
  method: zod.z.literal("notifications/roots/list_changed")
});
const ClientRequestSchema = zod.z.union([
  PingRequestSchema,
  InitializeRequestSchema,
  CompleteRequestSchema,
  SetLevelRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  CallToolRequestSchema,
  ListToolsRequestSchema
]);
const ClientNotificationSchema = zod.z.union([
  CancelledNotificationSchema,
  ProgressNotificationSchema,
  InitializedNotificationSchema,
  RootsListChangedNotificationSchema
]);
const ClientResultSchema = zod.z.union([EmptyResultSchema, CreateMessageResultSchema, ElicitResultSchema, ListRootsResultSchema]);
const ServerRequestSchema = zod.z.union([PingRequestSchema, CreateMessageRequestSchema, ElicitRequestSchema, ListRootsRequestSchema]);
const ServerNotificationSchema = zod.z.union([
  CancelledNotificationSchema,
  ProgressNotificationSchema,
  LoggingMessageNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
  PromptListChangedNotificationSchema
]);
const ServerResultSchema = zod.z.union([
  EmptyResultSchema,
  InitializeResultSchema,
  CompleteResultSchema,
  GetPromptResultSchema,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesResultSchema,
  ReadResourceResultSchema,
  CallToolResultSchema,
  ListToolsResultSchema
]);
class McpError extends Error {
  constructor(code, message, data) {
    super(`MCP error ${code}: ${message}`);
    this.code = code;
    this.data = data;
    this.name = "McpError";
  }
}
exports.AudioContentSchema = AudioContentSchema;
exports.BaseMetadataSchema = BaseMetadataSchema;
exports.BlobResourceContentsSchema = BlobResourceContentsSchema;
exports.BooleanSchemaSchema = BooleanSchemaSchema;
exports.CallToolRequestSchema = CallToolRequestSchema;
exports.CallToolResultSchema = CallToolResultSchema;
exports.CancelledNotificationSchema = CancelledNotificationSchema;
exports.ClientCapabilitiesSchema = ClientCapabilitiesSchema;
exports.ClientNotificationSchema = ClientNotificationSchema;
exports.ClientRequestSchema = ClientRequestSchema;
exports.ClientResultSchema = ClientResultSchema;
exports.CompatibilityCallToolResultSchema = CompatibilityCallToolResultSchema;
exports.CompleteRequestSchema = CompleteRequestSchema;
exports.CompleteResultSchema = CompleteResultSchema;
exports.ContentBlockSchema = ContentBlockSchema;
exports.CreateMessageRequestSchema = CreateMessageRequestSchema;
exports.CreateMessageResultSchema = CreateMessageResultSchema;
exports.CursorSchema = CursorSchema;
exports.DEFAULT_NEGOTIATED_PROTOCOL_VERSION = DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
exports.ElicitRequestSchema = ElicitRequestSchema;
exports.ElicitResultSchema = ElicitResultSchema;
exports.EmbeddedResourceSchema = EmbeddedResourceSchema;
exports.EmptyResultSchema = EmptyResultSchema;
exports.EnumSchemaSchema = EnumSchemaSchema;
exports.ErrorCode = ErrorCode;
exports.GetPromptRequestSchema = GetPromptRequestSchema;
exports.GetPromptResultSchema = GetPromptResultSchema;
exports.IconSchema = IconSchema;
exports.IconsSchema = IconsSchema;
exports.ImageContentSchema = ImageContentSchema;
exports.ImplementationSchema = ImplementationSchema;
exports.InitializeRequestSchema = InitializeRequestSchema;
exports.InitializeResultSchema = InitializeResultSchema;
exports.InitializedNotificationSchema = InitializedNotificationSchema;
exports.JSONRPCErrorSchema = JSONRPCErrorSchema;
exports.JSONRPCMessageSchema = JSONRPCMessageSchema;
exports.JSONRPCNotificationSchema = JSONRPCNotificationSchema;
exports.JSONRPCRequestSchema = JSONRPCRequestSchema;
exports.JSONRPCResponseSchema = JSONRPCResponseSchema;
exports.JSONRPC_VERSION = JSONRPC_VERSION;
exports.LATEST_PROTOCOL_VERSION = LATEST_PROTOCOL_VERSION;
exports.ListPromptsRequestSchema = ListPromptsRequestSchema;
exports.ListPromptsResultSchema = ListPromptsResultSchema;
exports.ListResourceTemplatesRequestSchema = ListResourceTemplatesRequestSchema;
exports.ListResourceTemplatesResultSchema = ListResourceTemplatesResultSchema;
exports.ListResourcesRequestSchema = ListResourcesRequestSchema;
exports.ListResourcesResultSchema = ListResourcesResultSchema;
exports.ListRootsRequestSchema = ListRootsRequestSchema;
exports.ListRootsResultSchema = ListRootsResultSchema;
exports.ListToolsRequestSchema = ListToolsRequestSchema;
exports.ListToolsResultSchema = ListToolsResultSchema;
exports.LoggingLevelSchema = LoggingLevelSchema;
exports.LoggingMessageNotificationSchema = LoggingMessageNotificationSchema;
exports.McpError = McpError;
exports.ModelHintSchema = ModelHintSchema;
exports.ModelPreferencesSchema = ModelPreferencesSchema;
exports.NotificationSchema = NotificationSchema;
exports.NumberSchemaSchema = NumberSchemaSchema;
exports.PaginatedRequestSchema = PaginatedRequestSchema;
exports.PaginatedResultSchema = PaginatedResultSchema;
exports.PingRequestSchema = PingRequestSchema;
exports.PrimitiveSchemaDefinitionSchema = PrimitiveSchemaDefinitionSchema;
exports.ProgressNotificationSchema = ProgressNotificationSchema;
exports.ProgressSchema = ProgressSchema;
exports.ProgressTokenSchema = ProgressTokenSchema;
exports.PromptArgumentSchema = PromptArgumentSchema;
exports.PromptListChangedNotificationSchema = PromptListChangedNotificationSchema;
exports.PromptMessageSchema = PromptMessageSchema;
exports.PromptReferenceSchema = PromptReferenceSchema;
exports.PromptSchema = PromptSchema;
exports.ReadResourceRequestSchema = ReadResourceRequestSchema;
exports.ReadResourceResultSchema = ReadResourceResultSchema;
exports.RequestIdSchema = RequestIdSchema;
exports.RequestSchema = RequestSchema;
exports.ResourceContentsSchema = ResourceContentsSchema;
exports.ResourceLinkSchema = ResourceLinkSchema;
exports.ResourceListChangedNotificationSchema = ResourceListChangedNotificationSchema;
exports.ResourceReferenceSchema = ResourceReferenceSchema;
exports.ResourceSchema = ResourceSchema;
exports.ResourceTemplateReferenceSchema = ResourceTemplateReferenceSchema;
exports.ResourceTemplateSchema = ResourceTemplateSchema;
exports.ResourceUpdatedNotificationSchema = ResourceUpdatedNotificationSchema;
exports.ResultSchema = ResultSchema;
exports.RootSchema = RootSchema;
exports.RootsListChangedNotificationSchema = RootsListChangedNotificationSchema;
exports.SUPPORTED_PROTOCOL_VERSIONS = SUPPORTED_PROTOCOL_VERSIONS;
exports.SamplingMessageSchema = SamplingMessageSchema;
exports.ServerCapabilitiesSchema = ServerCapabilitiesSchema;
exports.ServerNotificationSchema = ServerNotificationSchema;
exports.ServerRequestSchema = ServerRequestSchema;
exports.ServerResultSchema = ServerResultSchema;
exports.SetLevelRequestSchema = SetLevelRequestSchema;
exports.StringSchemaSchema = StringSchemaSchema;
exports.SubscribeRequestSchema = SubscribeRequestSchema;
exports.TextContentSchema = TextContentSchema;
exports.TextResourceContentsSchema = TextResourceContentsSchema;
exports.ToolAnnotationsSchema = ToolAnnotationsSchema;
exports.ToolListChangedNotificationSchema = ToolListChangedNotificationSchema;
exports.ToolSchema = ToolSchema;
exports.UnsubscribeRequestSchema = UnsubscribeRequestSchema;
exports.isInitializeRequest = isInitializeRequest;
exports.isInitializedNotification = isInitializedNotification;
exports.isJSONRPCError = isJSONRPCError;
exports.isJSONRPCNotification = isJSONRPCNotification;
exports.isJSONRPCRequest = isJSONRPCRequest;
exports.isJSONRPCResponse = isJSONRPCResponse;
//# sourceMappingURL=types.js.map
