import { z } from "zod";
const LATEST_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-03-26", "2024-11-05", "2024-10-07"];
const JSONRPC_VERSION = "2.0";
const ProgressTokenSchema = z.union([z.string(), z.number().int()]);
const CursorSchema = z.string();
const RequestMetaSchema = z.object({
  /**
   * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
   */
  progressToken: z.optional(ProgressTokenSchema)
}).passthrough();
const BaseRequestParamsSchema = z.object({
  _meta: z.optional(RequestMetaSchema)
}).passthrough();
const RequestSchema = z.object({
  method: z.string(),
  params: z.optional(BaseRequestParamsSchema)
});
const BaseNotificationParamsSchema = z.object({
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
const NotificationSchema = z.object({
  method: z.string(),
  params: z.optional(BaseNotificationParamsSchema)
});
const ResultSchema = z.object({
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
const RequestIdSchema = z.union([z.string(), z.number().int()]);
const JSONRPCRequestSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
  id: RequestIdSchema
}).merge(RequestSchema).strict();
const isJSONRPCRequest = (value) => JSONRPCRequestSchema.safeParse(value).success;
const JSONRPCNotificationSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION)
}).merge(NotificationSchema).strict();
const isJSONRPCNotification = (value) => JSONRPCNotificationSchema.safeParse(value).success;
const JSONRPCResponseSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
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
const JSONRPCErrorSchema = z.object({
  jsonrpc: z.literal(JSONRPC_VERSION),
  id: RequestIdSchema,
  error: z.object({
    /**
     * The error type that occurred.
     */
    code: z.number().int(),
    /**
     * A short description of the error. The message SHOULD be limited to a concise single sentence.
     */
    message: z.string(),
    /**
     * Additional information about the error. The value of this member is defined by the sender (e.g. detailed error information, nested errors etc.).
     */
    data: z.optional(z.unknown())
  })
}).strict();
const isJSONRPCError = (value) => JSONRPCErrorSchema.safeParse(value).success;
const JSONRPCMessageSchema = z.union([JSONRPCRequestSchema, JSONRPCNotificationSchema, JSONRPCResponseSchema, JSONRPCErrorSchema]);
const EmptyResultSchema = ResultSchema.strict();
const CancelledNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/cancelled"),
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
    reason: z.string().optional()
  })
});
const IconSchema = z.object({
  /**
   * URL or data URI for the icon.
   */
  src: z.string(),
  /**
   * Optional MIME type for the icon.
   */
  mimeType: z.optional(z.string()),
  /**
   * Optional array of strings that specify sizes at which the icon can be used.
   * Each string should be in WxH format (e.g., `"48x48"`, `"96x96"`) or `"any"` for scalable formats like SVG.
   *
   * If not provided, the client should assume that the icon can be used at any size.
   */
  sizes: z.optional(z.array(z.string()))
}).passthrough();
const IconsSchema = z.object({
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
  icons: z.array(IconSchema).optional()
}).passthrough();
const BaseMetadataSchema = z.object({
  /** Intended for programmatic or logical use, but used as a display name in past specs or fallback */
  name: z.string(),
  /**
   * Intended for UI and end-user contexts — optimized to be human-readable and easily understood,
   * even by those unfamiliar with domain-specific terminology.
   *
   * If not provided, the name should be used for display (except for Tool,
   * where `annotations.title` should be given precedence over using `name`,
   * if present).
   */
  title: z.optional(z.string())
}).passthrough();
const ImplementationSchema = BaseMetadataSchema.extend({
  version: z.string(),
  /**
   * An optional URL of the website for this implementation.
   */
  websiteUrl: z.optional(z.string())
}).merge(IconsSchema);
const ClientCapabilitiesSchema = z.object({
  /**
   * Experimental, non-standard capabilities that the client supports.
   */
  experimental: z.optional(z.object({}).passthrough()),
  /**
   * Present if the client supports sampling from an LLM.
   */
  sampling: z.optional(z.object({}).passthrough()),
  /**
   * Present if the client supports eliciting user input.
   */
  elicitation: z.optional(z.object({}).passthrough()),
  /**
   * Present if the client supports listing roots.
   */
  roots: z.optional(
    z.object({
      /**
       * Whether the client supports issuing notifications for changes to the roots list.
       */
      listChanged: z.optional(z.boolean())
    }).passthrough()
  )
}).passthrough();
const InitializeRequestSchema = RequestSchema.extend({
  method: z.literal("initialize"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
     */
    protocolVersion: z.string(),
    capabilities: ClientCapabilitiesSchema,
    clientInfo: ImplementationSchema
  })
});
const isInitializeRequest = (value) => InitializeRequestSchema.safeParse(value).success;
const ServerCapabilitiesSchema = z.object({
  /**
   * Experimental, non-standard capabilities that the server supports.
   */
  experimental: z.optional(z.object({}).passthrough()),
  /**
   * Present if the server supports sending log messages to the client.
   */
  logging: z.optional(z.object({}).passthrough()),
  /**
   * Present if the server supports sending completions to the client.
   */
  completions: z.optional(z.object({}).passthrough()),
  /**
   * Present if the server offers any prompt templates.
   */
  prompts: z.optional(
    z.object({
      /**
       * Whether this server supports issuing notifications for changes to the prompt list.
       */
      listChanged: z.optional(z.boolean())
    }).passthrough()
  ),
  /**
   * Present if the server offers any resources to read.
   */
  resources: z.optional(
    z.object({
      /**
       * Whether this server supports clients subscribing to resource updates.
       */
      subscribe: z.optional(z.boolean()),
      /**
       * Whether this server supports issuing notifications for changes to the resource list.
       */
      listChanged: z.optional(z.boolean())
    }).passthrough()
  ),
  /**
   * Present if the server offers any tools to call.
   */
  tools: z.optional(
    z.object({
      /**
       * Whether this server supports issuing notifications for changes to the tool list.
       */
      listChanged: z.optional(z.boolean())
    }).passthrough()
  )
}).passthrough();
const InitializeResultSchema = ResultSchema.extend({
  /**
   * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
   */
  protocolVersion: z.string(),
  capabilities: ServerCapabilitiesSchema,
  serverInfo: ImplementationSchema,
  /**
   * Instructions describing how to use the server and its features.
   *
   * This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
   */
  instructions: z.optional(z.string())
});
const InitializedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/initialized")
});
const isInitializedNotification = (value) => InitializedNotificationSchema.safeParse(value).success;
const PingRequestSchema = RequestSchema.extend({
  method: z.literal("ping")
});
const ProgressSchema = z.object({
  /**
   * The progress thus far. This should increase every time progress is made, even if the total is unknown.
   */
  progress: z.number(),
  /**
   * Total number of items to process (or total progress required), if known.
   */
  total: z.optional(z.number()),
  /**
   * An optional message describing the current progress.
   */
  message: z.optional(z.string())
}).passthrough();
const ProgressNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/progress"),
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
    cursor: z.optional(CursorSchema)
  }).optional()
});
const PaginatedResultSchema = ResultSchema.extend({
  /**
   * An opaque token representing the pagination position after the last returned result.
   * If present, there may be more results available.
   */
  nextCursor: z.optional(CursorSchema)
});
const ResourceContentsSchema = z.object({
  /**
   * The URI of this resource.
   */
  uri: z.string(),
  /**
   * The MIME type of this resource, if known.
   */
  mimeType: z.optional(z.string()),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
const TextResourceContentsSchema = ResourceContentsSchema.extend({
  /**
   * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
   */
  text: z.string()
});
const Base64Schema = z.string().refine(
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
  uri: z.string(),
  /**
   * A description of what this resource represents.
   *
   * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
   */
  description: z.optional(z.string()),
  /**
   * The MIME type of this resource, if known.
   */
  mimeType: z.optional(z.string()),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).merge(IconsSchema);
const ResourceTemplateSchema = BaseMetadataSchema.extend({
  /**
   * A URI template (according to RFC 6570) that can be used to construct resource URIs.
   */
  uriTemplate: z.string(),
  /**
   * A description of what this template is for.
   *
   * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
   */
  description: z.optional(z.string()),
  /**
   * The MIME type for all resources that match this template. This should only be included if all resources matching this template have the same type.
   */
  mimeType: z.optional(z.string()),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).merge(IconsSchema);
const ListResourcesRequestSchema = PaginatedRequestSchema.extend({
  method: z.literal("resources/list")
});
const ListResourcesResultSchema = PaginatedResultSchema.extend({
  resources: z.array(ResourceSchema)
});
const ListResourceTemplatesRequestSchema = PaginatedRequestSchema.extend({
  method: z.literal("resources/templates/list")
});
const ListResourceTemplatesResultSchema = PaginatedResultSchema.extend({
  resourceTemplates: z.array(ResourceTemplateSchema)
});
const ReadResourceRequestSchema = RequestSchema.extend({
  method: z.literal("resources/read"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The URI of the resource to read. The URI can use any protocol; it is up to the server how to interpret it.
     */
    uri: z.string()
  })
});
const ReadResourceResultSchema = ResultSchema.extend({
  contents: z.array(z.union([TextResourceContentsSchema, BlobResourceContentsSchema]))
});
const ResourceListChangedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/resources/list_changed")
});
const SubscribeRequestSchema = RequestSchema.extend({
  method: z.literal("resources/subscribe"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The URI of the resource to subscribe to. The URI can use any protocol; it is up to the server how to interpret it.
     */
    uri: z.string()
  })
});
const UnsubscribeRequestSchema = RequestSchema.extend({
  method: z.literal("resources/unsubscribe"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The URI of the resource to unsubscribe from.
     */
    uri: z.string()
  })
});
const ResourceUpdatedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/resources/updated"),
  params: BaseNotificationParamsSchema.extend({
    /**
     * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
     */
    uri: z.string()
  })
});
const PromptArgumentSchema = z.object({
  /**
   * The name of the argument.
   */
  name: z.string(),
  /**
   * A human-readable description of the argument.
   */
  description: z.optional(z.string()),
  /**
   * Whether this argument must be provided.
   */
  required: z.optional(z.boolean())
}).passthrough();
const PromptSchema = BaseMetadataSchema.extend({
  /**
   * An optional description of what this prompt provides
   */
  description: z.optional(z.string()),
  /**
   * A list of arguments to use for templating the prompt.
   */
  arguments: z.optional(z.array(PromptArgumentSchema)),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).merge(IconsSchema);
const ListPromptsRequestSchema = PaginatedRequestSchema.extend({
  method: z.literal("prompts/list")
});
const ListPromptsResultSchema = PaginatedResultSchema.extend({
  prompts: z.array(PromptSchema)
});
const GetPromptRequestSchema = RequestSchema.extend({
  method: z.literal("prompts/get"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The name of the prompt or prompt template.
     */
    name: z.string(),
    /**
     * Arguments to use for templating the prompt.
     */
    arguments: z.optional(z.record(z.string()))
  })
});
const TextContentSchema = z.object({
  type: z.literal("text"),
  /**
   * The text content of the message.
   */
  text: z.string(),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
const ImageContentSchema = z.object({
  type: z.literal("image"),
  /**
   * The base64-encoded image data.
   */
  data: Base64Schema,
  /**
   * The MIME type of the image. Different providers may support different image types.
   */
  mimeType: z.string(),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
const AudioContentSchema = z.object({
  type: z.literal("audio"),
  /**
   * The base64-encoded audio data.
   */
  data: Base64Schema,
  /**
   * The MIME type of the audio. Different providers may support different audio types.
   */
  mimeType: z.string(),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
const EmbeddedResourceSchema = z.object({
  type: z.literal("resource"),
  resource: z.union([TextResourceContentsSchema, BlobResourceContentsSchema]),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
const ResourceLinkSchema = ResourceSchema.extend({
  type: z.literal("resource_link")
});
const ContentBlockSchema = z.union([
  TextContentSchema,
  ImageContentSchema,
  AudioContentSchema,
  ResourceLinkSchema,
  EmbeddedResourceSchema
]);
const PromptMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: ContentBlockSchema
}).passthrough();
const GetPromptResultSchema = ResultSchema.extend({
  /**
   * An optional description for the prompt.
   */
  description: z.optional(z.string()),
  messages: z.array(PromptMessageSchema)
});
const PromptListChangedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/prompts/list_changed")
});
const ToolAnnotationsSchema = z.object({
  /**
   * A human-readable title for the tool.
   */
  title: z.optional(z.string()),
  /**
   * If true, the tool does not modify its environment.
   *
   * Default: false
   */
  readOnlyHint: z.optional(z.boolean()),
  /**
   * If true, the tool may perform destructive updates to its environment.
   * If false, the tool performs only additive updates.
   *
   * (This property is meaningful only when `readOnlyHint == false`)
   *
   * Default: true
   */
  destructiveHint: z.optional(z.boolean()),
  /**
   * If true, calling the tool repeatedly with the same arguments
   * will have no additional effect on the its environment.
   *
   * (This property is meaningful only when `readOnlyHint == false`)
   *
   * Default: false
   */
  idempotentHint: z.optional(z.boolean()),
  /**
   * If true, this tool may interact with an "open world" of external
   * entities. If false, the tool's domain of interaction is closed.
   * For example, the world of a web search tool is open, whereas that
   * of a memory tool is not.
   *
   * Default: true
   */
  openWorldHint: z.optional(z.boolean())
}).passthrough();
const ToolSchema = BaseMetadataSchema.extend({
  /**
   * A human-readable description of the tool.
   */
  description: z.optional(z.string()),
  /**
   * A JSON Schema object defining the expected parameters for the tool.
   */
  inputSchema: z.object({
    type: z.literal("object"),
    properties: z.optional(z.object({}).passthrough()),
    required: z.optional(z.array(z.string()))
  }).passthrough(),
  /**
   * An optional JSON Schema object defining the structure of the tool's output returned in
   * the structuredContent field of a CallToolResult.
   */
  outputSchema: z.optional(
    z.object({
      type: z.literal("object"),
      properties: z.optional(z.object({}).passthrough()),
      required: z.optional(z.array(z.string()))
    }).passthrough()
  ),
  /**
   * Optional additional tool information.
   */
  annotations: z.optional(ToolAnnotationsSchema),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).merge(IconsSchema);
const ListToolsRequestSchema = PaginatedRequestSchema.extend({
  method: z.literal("tools/list")
});
const ListToolsResultSchema = PaginatedResultSchema.extend({
  tools: z.array(ToolSchema)
});
const CallToolResultSchema = ResultSchema.extend({
  /**
   * A list of content objects that represent the result of the tool call.
   *
   * If the Tool does not define an outputSchema, this field MUST be present in the result.
   * For backwards compatibility, this field is always present, but it may be empty.
   */
  content: z.array(ContentBlockSchema).default([]),
  /**
   * An object containing structured tool output.
   *
   * If the Tool defines an outputSchema, this field MUST be present in the result, and contain a JSON object that matches the schema.
   */
  structuredContent: z.object({}).passthrough().optional(),
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
  isError: z.optional(z.boolean())
});
const CompatibilityCallToolResultSchema = CallToolResultSchema.or(
  ResultSchema.extend({
    toolResult: z.unknown()
  })
);
const CallToolRequestSchema = RequestSchema.extend({
  method: z.literal("tools/call"),
  params: BaseRequestParamsSchema.extend({
    name: z.string(),
    arguments: z.optional(z.record(z.unknown()))
  })
});
const ToolListChangedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/tools/list_changed")
});
const LoggingLevelSchema = z.enum(["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"]);
const SetLevelRequestSchema = RequestSchema.extend({
  method: z.literal("logging/setLevel"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The level of logging that the client wants to receive from the server. The server should send all logs at this level and higher (i.e., more severe) to the client as notifications/logging/message.
     */
    level: LoggingLevelSchema
  })
});
const LoggingMessageNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/message"),
  params: BaseNotificationParamsSchema.extend({
    /**
     * The severity of this log message.
     */
    level: LoggingLevelSchema,
    /**
     * An optional name of the logger issuing this message.
     */
    logger: z.optional(z.string()),
    /**
     * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
     */
    data: z.unknown()
  })
});
const ModelHintSchema = z.object({
  /**
   * A hint for a model name.
   */
  name: z.string().optional()
}).passthrough();
const ModelPreferencesSchema = z.object({
  /**
   * Optional hints to use for model selection.
   */
  hints: z.optional(z.array(ModelHintSchema)),
  /**
   * How much to prioritize cost when selecting a model.
   */
  costPriority: z.optional(z.number().min(0).max(1)),
  /**
   * How much to prioritize sampling speed (latency) when selecting a model.
   */
  speedPriority: z.optional(z.number().min(0).max(1)),
  /**
   * How much to prioritize intelligence and capabilities when selecting a model.
   */
  intelligencePriority: z.optional(z.number().min(0).max(1))
}).passthrough();
const SamplingMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([TextContentSchema, ImageContentSchema, AudioContentSchema])
}).passthrough();
const CreateMessageRequestSchema = RequestSchema.extend({
  method: z.literal("sampling/createMessage"),
  params: BaseRequestParamsSchema.extend({
    messages: z.array(SamplingMessageSchema),
    /**
     * An optional system prompt the server wants to use for sampling. The client MAY modify or omit this prompt.
     */
    systemPrompt: z.optional(z.string()),
    /**
     * A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request.
     */
    includeContext: z.optional(z.enum(["none", "thisServer", "allServers"])),
    temperature: z.optional(z.number()),
    /**
     * The maximum number of tokens to sample, as requested by the server. The client MAY choose to sample fewer tokens than requested.
     */
    maxTokens: z.number().int(),
    stopSequences: z.optional(z.array(z.string())),
    /**
     * Optional metadata to pass through to the LLM provider. The format of this metadata is provider-specific.
     */
    metadata: z.optional(z.object({}).passthrough()),
    /**
     * The server's preferences for which model to select.
     */
    modelPreferences: z.optional(ModelPreferencesSchema)
  })
});
const CreateMessageResultSchema = ResultSchema.extend({
  /**
   * The name of the model that generated the message.
   */
  model: z.string(),
  /**
   * The reason why sampling stopped.
   */
  stopReason: z.optional(z.enum(["endTurn", "stopSequence", "maxTokens"]).or(z.string())),
  role: z.enum(["user", "assistant"]),
  content: z.discriminatedUnion("type", [TextContentSchema, ImageContentSchema, AudioContentSchema])
});
const BooleanSchemaSchema = z.object({
  type: z.literal("boolean"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  default: z.optional(z.boolean())
}).passthrough();
const StringSchemaSchema = z.object({
  type: z.literal("string"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  minLength: z.optional(z.number()),
  maxLength: z.optional(z.number()),
  format: z.optional(z.enum(["email", "uri", "date", "date-time"]))
}).passthrough();
const NumberSchemaSchema = z.object({
  type: z.enum(["number", "integer"]),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  minimum: z.optional(z.number()),
  maximum: z.optional(z.number())
}).passthrough();
const EnumSchemaSchema = z.object({
  type: z.literal("string"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  enum: z.array(z.string()),
  enumNames: z.optional(z.array(z.string()))
}).passthrough();
const PrimitiveSchemaDefinitionSchema = z.union([BooleanSchemaSchema, StringSchemaSchema, NumberSchemaSchema, EnumSchemaSchema]);
const ElicitRequestSchema = RequestSchema.extend({
  method: z.literal("elicitation/create"),
  params: BaseRequestParamsSchema.extend({
    /**
     * The message to present to the user.
     */
    message: z.string(),
    /**
     * The schema for the requested user input.
     */
    requestedSchema: z.object({
      type: z.literal("object"),
      properties: z.record(z.string(), PrimitiveSchemaDefinitionSchema),
      required: z.optional(z.array(z.string()))
    }).passthrough()
  })
});
const ElicitResultSchema = ResultSchema.extend({
  /**
   * The user's response action.
   */
  action: z.enum(["accept", "decline", "cancel"]),
  /**
   * The collected user input content (only present if action is "accept").
   */
  content: z.optional(z.record(z.string(), z.unknown()))
});
const ResourceTemplateReferenceSchema = z.object({
  type: z.literal("ref/resource"),
  /**
   * The URI or URI template of the resource.
   */
  uri: z.string()
}).passthrough();
const ResourceReferenceSchema = ResourceTemplateReferenceSchema;
const PromptReferenceSchema = z.object({
  type: z.literal("ref/prompt"),
  /**
   * The name of the prompt or prompt template
   */
  name: z.string()
}).passthrough();
const CompleteRequestSchema = RequestSchema.extend({
  method: z.literal("completion/complete"),
  params: BaseRequestParamsSchema.extend({
    ref: z.union([PromptReferenceSchema, ResourceTemplateReferenceSchema]),
    /**
     * The argument's information
     */
    argument: z.object({
      /**
       * The name of the argument
       */
      name: z.string(),
      /**
       * The value of the argument to use for completion matching.
       */
      value: z.string()
    }).passthrough(),
    context: z.optional(
      z.object({
        /**
         * Previously-resolved variables in a URI template or prompt.
         */
        arguments: z.optional(z.record(z.string(), z.string()))
      })
    )
  })
});
const CompleteResultSchema = ResultSchema.extend({
  completion: z.object({
    /**
     * An array of completion values. Must not exceed 100 items.
     */
    values: z.array(z.string()).max(100),
    /**
     * The total number of completion options available. This can exceed the number of values actually sent in the response.
     */
    total: z.optional(z.number().int()),
    /**
     * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
     */
    hasMore: z.optional(z.boolean())
  }).passthrough()
});
const RootSchema = z.object({
  /**
   * The URI identifying the root. This *must* start with file:// for now.
   */
  uri: z.string().startsWith("file://"),
  /**
   * An optional name for the root.
   */
  name: z.optional(z.string()),
  /**
   * See [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/47339c03c143bb4ec01a26e721a1b8fe66634ebe/docs/specification/draft/basic/index.mdx#general-fields)
   * for notes on _meta usage.
   */
  _meta: z.optional(z.object({}).passthrough())
}).passthrough();
const ListRootsRequestSchema = RequestSchema.extend({
  method: z.literal("roots/list")
});
const ListRootsResultSchema = ResultSchema.extend({
  roots: z.array(RootSchema)
});
const RootsListChangedNotificationSchema = NotificationSchema.extend({
  method: z.literal("notifications/roots/list_changed")
});
const ClientRequestSchema = z.union([
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
const ClientNotificationSchema = z.union([
  CancelledNotificationSchema,
  ProgressNotificationSchema,
  InitializedNotificationSchema,
  RootsListChangedNotificationSchema
]);
const ClientResultSchema = z.union([EmptyResultSchema, CreateMessageResultSchema, ElicitResultSchema, ListRootsResultSchema]);
const ServerRequestSchema = z.union([PingRequestSchema, CreateMessageRequestSchema, ElicitRequestSchema, ListRootsRequestSchema]);
const ServerNotificationSchema = z.union([
  CancelledNotificationSchema,
  ProgressNotificationSchema,
  LoggingMessageNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
  PromptListChangedNotificationSchema
]);
const ServerResultSchema = z.union([
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
export {
  AudioContentSchema,
  BaseMetadataSchema,
  BlobResourceContentsSchema,
  BooleanSchemaSchema,
  CallToolRequestSchema,
  CallToolResultSchema,
  CancelledNotificationSchema,
  ClientCapabilitiesSchema,
  ClientNotificationSchema,
  ClientRequestSchema,
  ClientResultSchema,
  CompatibilityCallToolResultSchema,
  CompleteRequestSchema,
  CompleteResultSchema,
  ContentBlockSchema,
  CreateMessageRequestSchema,
  CreateMessageResultSchema,
  CursorSchema,
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  ElicitRequestSchema,
  ElicitResultSchema,
  EmbeddedResourceSchema,
  EmptyResultSchema,
  EnumSchemaSchema,
  ErrorCode,
  GetPromptRequestSchema,
  GetPromptResultSchema,
  IconSchema,
  IconsSchema,
  ImageContentSchema,
  ImplementationSchema,
  InitializeRequestSchema,
  InitializeResultSchema,
  InitializedNotificationSchema,
  JSONRPCErrorSchema,
  JSONRPCMessageSchema,
  JSONRPCNotificationSchema,
  JSONRPCRequestSchema,
  JSONRPCResponseSchema,
  JSONRPC_VERSION,
  LATEST_PROTOCOL_VERSION,
  ListPromptsRequestSchema,
  ListPromptsResultSchema,
  ListResourceTemplatesRequestSchema,
  ListResourceTemplatesResultSchema,
  ListResourcesRequestSchema,
  ListResourcesResultSchema,
  ListRootsRequestSchema,
  ListRootsResultSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  LoggingLevelSchema,
  LoggingMessageNotificationSchema,
  McpError,
  ModelHintSchema,
  ModelPreferencesSchema,
  NotificationSchema,
  NumberSchemaSchema,
  PaginatedRequestSchema,
  PaginatedResultSchema,
  PingRequestSchema,
  PrimitiveSchemaDefinitionSchema,
  ProgressNotificationSchema,
  ProgressSchema,
  ProgressTokenSchema,
  PromptArgumentSchema,
  PromptListChangedNotificationSchema,
  PromptMessageSchema,
  PromptReferenceSchema,
  PromptSchema,
  ReadResourceRequestSchema,
  ReadResourceResultSchema,
  RequestIdSchema,
  RequestSchema,
  ResourceContentsSchema,
  ResourceLinkSchema,
  ResourceListChangedNotificationSchema,
  ResourceReferenceSchema,
  ResourceSchema,
  ResourceTemplateReferenceSchema,
  ResourceTemplateSchema,
  ResourceUpdatedNotificationSchema,
  ResultSchema,
  RootSchema,
  RootsListChangedNotificationSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  SamplingMessageSchema,
  ServerCapabilitiesSchema,
  ServerNotificationSchema,
  ServerRequestSchema,
  ServerResultSchema,
  SetLevelRequestSchema,
  StringSchemaSchema,
  SubscribeRequestSchema,
  TextContentSchema,
  TextResourceContentsSchema,
  ToolAnnotationsSchema,
  ToolListChangedNotificationSchema,
  ToolSchema,
  UnsubscribeRequestSchema,
  isInitializeRequest,
  isInitializedNotification,
  isJSONRPCError,
  isJSONRPCNotification,
  isJSONRPCRequest,
  isJSONRPCResponse
};
//# sourceMappingURL=types.js.map
