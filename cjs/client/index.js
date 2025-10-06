"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const protocol = require("../shared/protocol.js");
const types = require("../types.js");
const Ajv = require("ajv");
class Client extends protocol.Protocol {
  /**
   * Initializes this client with the given name and version information.
   */
  constructor(_clientInfo, options) {
    super(options);
    this._clientInfo = _clientInfo;
    this._cachedToolOutputValidators = /* @__PURE__ */ new Map();
    this._capabilities = options?.capabilities ?? {};
    this._ajv = new Ajv();
  }
  /**
   * Registers new capabilities. This can only be called before connecting to a transport.
   *
   * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
   */
  registerCapabilities(capabilities) {
    if (this.transport) {
      throw new Error("Cannot register capabilities after connecting to transport");
    }
    this._capabilities = protocol.mergeCapabilities(this._capabilities, capabilities);
  }
  assertCapability(capability, method) {
    if (!this._serverCapabilities?.[capability]) {
      throw new Error(`Server does not support ${capability} (required for ${method})`);
    }
  }
  async connect(transport, options) {
    await super.connect(transport);
    if (transport.sessionId !== void 0) {
      return;
    }
    try {
      const result = await this.request(
        {
          method: "initialize",
          params: {
            protocolVersion: types.LATEST_PROTOCOL_VERSION,
            capabilities: this._capabilities,
            clientInfo: this._clientInfo
          }
        },
        types.InitializeResultSchema,
        options
      );
      if (result === void 0) {
        throw new Error(`Server sent invalid initialize result: ${result}`);
      }
      if (!types.SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
        throw new Error(`Server's protocol version is not supported: ${result.protocolVersion}`);
      }
      this._serverCapabilities = result.capabilities;
      this._serverVersion = result.serverInfo;
      if (transport.setProtocolVersion) {
        transport.setProtocolVersion(result.protocolVersion);
      }
      this._instructions = result.instructions;
      await this.notification({
        method: "notifications/initialized"
      });
    } catch (error) {
      void this.close();
      throw error;
    }
  }
  /**
   * After initialization has completed, this will be populated with the server's reported capabilities.
   */
  getServerCapabilities() {
    return this._serverCapabilities;
  }
  /**
   * After initialization has completed, this will be populated with information about the server's name and version.
   */
  getServerVersion() {
    return this._serverVersion;
  }
  /**
   * After initialization has completed, this may be populated with information about the server's instructions.
   */
  getInstructions() {
    return this._instructions;
  }
  assertCapabilityForMethod(method) {
    switch (method) {
      case "logging/setLevel":
        if (!this._serverCapabilities?.logging) {
          throw new Error(`Server does not support logging (required for ${method})`);
        }
        break;
      case "prompts/get":
      case "prompts/list":
        if (!this._serverCapabilities?.prompts) {
          throw new Error(`Server does not support prompts (required for ${method})`);
        }
        break;
      case "resources/list":
      case "resources/templates/list":
      case "resources/read":
      case "resources/subscribe":
      case "resources/unsubscribe":
        if (!this._serverCapabilities?.resources) {
          throw new Error(`Server does not support resources (required for ${method})`);
        }
        if (method === "resources/subscribe" && !this._serverCapabilities.resources.subscribe) {
          throw new Error(`Server does not support resource subscriptions (required for ${method})`);
        }
        break;
      case "tools/call":
      case "tools/list":
        if (!this._serverCapabilities?.tools) {
          throw new Error(`Server does not support tools (required for ${method})`);
        }
        break;
      case "completion/complete":
        if (!this._serverCapabilities?.completions) {
          throw new Error(`Server does not support completions (required for ${method})`);
        }
        break;
      case "initialize":
        break;
      case "ping":
        break;
    }
  }
  assertNotificationCapability(method) {
    switch (method) {
      case "notifications/roots/list_changed":
        if (!this._capabilities.roots?.listChanged) {
          throw new Error(`Client does not support roots list changed notifications (required for ${method})`);
        }
        break;
      case "notifications/initialized":
        break;
      case "notifications/cancelled":
        break;
      case "notifications/progress":
        break;
    }
  }
  assertRequestHandlerCapability(method) {
    switch (method) {
      case "sampling/createMessage":
        if (!this._capabilities.sampling) {
          throw new Error(`Client does not support sampling capability (required for ${method})`);
        }
        break;
      case "elicitation/create":
        if (!this._capabilities.elicitation) {
          throw new Error(`Client does not support elicitation capability (required for ${method})`);
        }
        break;
      case "roots/list":
        if (!this._capabilities.roots) {
          throw new Error(`Client does not support roots capability (required for ${method})`);
        }
        break;
      case "ping":
        break;
    }
  }
  async ping(options) {
    return this.request({ method: "ping" }, types.EmptyResultSchema, options);
  }
  async complete(params, options) {
    return this.request({ method: "completion/complete", params }, types.CompleteResultSchema, options);
  }
  async setLoggingLevel(level, options) {
    return this.request({ method: "logging/setLevel", params: { level } }, types.EmptyResultSchema, options);
  }
  async getPrompt(params, options) {
    return this.request({ method: "prompts/get", params }, types.GetPromptResultSchema, options);
  }
  async listPrompts(params, options) {
    return this.request({ method: "prompts/list", params }, types.ListPromptsResultSchema, options);
  }
  async listResources(params, options) {
    return this.request({ method: "resources/list", params }, types.ListResourcesResultSchema, options);
  }
  async listResourceTemplates(params, options) {
    return this.request({ method: "resources/templates/list", params }, types.ListResourceTemplatesResultSchema, options);
  }
  async readResource(params, options) {
    return this.request({ method: "resources/read", params }, types.ReadResourceResultSchema, options);
  }
  async subscribeResource(params, options) {
    return this.request({ method: "resources/subscribe", params }, types.EmptyResultSchema, options);
  }
  async unsubscribeResource(params, options) {
    return this.request({ method: "resources/unsubscribe", params }, types.EmptyResultSchema, options);
  }
  async callTool(params, resultSchema = types.CallToolResultSchema, options) {
    const result = await this.request({ method: "tools/call", params }, resultSchema, options);
    const validator = this.getToolOutputValidator(params.name);
    if (validator) {
      if (!result.structuredContent && !result.isError) {
        throw new types.McpError(
          types.ErrorCode.InvalidRequest,
          `Tool ${params.name} has an output schema but did not return structured content`
        );
      }
      if (result.structuredContent) {
        try {
          const isValid = validator(result.structuredContent);
          if (!isValid) {
            throw new types.McpError(
              types.ErrorCode.InvalidParams,
              `Structured content does not match the tool's output schema: ${this._ajv.errorsText(validator.errors)}`
            );
          }
        } catch (error) {
          if (error instanceof types.McpError) {
            throw error;
          }
          throw new types.McpError(
            types.ErrorCode.InvalidParams,
            `Failed to validate structured content: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
    return result;
  }
  cacheToolOutputSchemas(tools) {
    this._cachedToolOutputValidators.clear();
    for (const tool of tools) {
      if (tool.outputSchema) {
        try {
          const validator = this._ajv.compile(tool.outputSchema);
          this._cachedToolOutputValidators.set(tool.name, validator);
        } catch {
        }
      }
    }
  }
  getToolOutputValidator(toolName) {
    return this._cachedToolOutputValidators.get(toolName);
  }
  async listTools(params, options) {
    const result = await this.request({ method: "tools/list", params }, types.ListToolsResultSchema, options);
    this.cacheToolOutputSchemas(result.tools);
    return result;
  }
  async sendRootsListChanged() {
    return this.notification({ method: "notifications/roots/list_changed" });
  }
}
exports.Client = Client;
//# sourceMappingURL=index.js.map
