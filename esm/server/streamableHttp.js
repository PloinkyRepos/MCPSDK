import { JSONRPCMessageSchema, isInitializeRequest, isJSONRPCRequest, DEFAULT_NEGOTIATED_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS, isJSONRPCResponse, isJSONRPCError } from "../types.js";
import getRawBody from "raw-body";
import contentType from "content-type";
import { randomUUID } from "node:crypto";
const MAXIMUM_MESSAGE_SIZE = "4mb";
class StreamableHTTPServerTransport {
  constructor(options) {
    this._started = false;
    this._streamMapping = /* @__PURE__ */ new Map();
    this._requestToStreamMapping = /* @__PURE__ */ new Map();
    this._requestResponseMap = /* @__PURE__ */ new Map();
    this._initialized = false;
    this._enableJsonResponse = false;
    this._standaloneSseStreamId = "_GET_stream";
    this.sessionIdGenerator = options.sessionIdGenerator;
    this._enableJsonResponse = options.enableJsonResponse ?? false;
    this._eventStore = options.eventStore;
    this._onsessioninitialized = options.onsessioninitialized;
    this._onsessionclosed = options.onsessionclosed;
    this._allowedHosts = options.allowedHosts;
    this._allowedOrigins = options.allowedOrigins;
    this._enableDnsRebindingProtection = options.enableDnsRebindingProtection ?? false;
  }
  /**
   * Starts the transport. This is required by the Transport interface but is a no-op
   * for the Streamable HTTP transport as connections are managed per-request.
   */
  async start() {
    if (this._started) {
      throw new Error("Transport already started");
    }
    this._started = true;
  }
  /**
   * Validates request headers for DNS rebinding protection.
   * @returns Error message if validation fails, undefined if validation passes.
   */
  validateRequestHeaders(req) {
    if (!this._enableDnsRebindingProtection) {
      return void 0;
    }
    if (this._allowedHosts && this._allowedHosts.length > 0) {
      const hostHeader = req.headers.host;
      if (!hostHeader || !this._allowedHosts.includes(hostHeader)) {
        return `Invalid Host header: ${hostHeader}`;
      }
    }
    if (this._allowedOrigins && this._allowedOrigins.length > 0) {
      const originHeader = req.headers.origin;
      if (!originHeader || !this._allowedOrigins.includes(originHeader)) {
        return `Invalid Origin header: ${originHeader}`;
      }
    }
    return void 0;
  }
  /**
   * Handles an incoming HTTP request, whether GET or POST
   */
  async handleRequest(req, res, parsedBody) {
    const validationError = this.validateRequestHeaders(req);
    if (validationError) {
      res.writeHead(403).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: validationError
          },
          id: null
        })
      );
      this.onerror?.(new Error(validationError));
      return;
    }
    if (req.method === "POST") {
      await this.handlePostRequest(req, res, parsedBody);
    } else if (req.method === "GET") {
      await this.handleGetRequest(req, res);
    } else if (req.method === "DELETE") {
      await this.handleDeleteRequest(req, res);
    } else {
      await this.handleUnsupportedRequest(res);
    }
  }
  /**
   * Handles GET requests for SSE stream
   */
  async handleGetRequest(req, res) {
    const acceptHeader = req.headers.accept;
    if (!acceptHeader?.includes("text/event-stream")) {
      res.writeHead(406).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Not Acceptable: Client must accept text/event-stream"
          },
          id: null
        })
      );
      return;
    }
    if (!this.validateSession(req, res)) {
      return;
    }
    if (!this.validateProtocolVersion(req, res)) {
      return;
    }
    if (this._eventStore) {
      const lastEventId = req.headers["last-event-id"];
      if (lastEventId) {
        await this.replayEvents(lastEventId, res);
        return;
      }
    }
    const headers = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    };
    if (this.sessionId !== void 0) {
      headers["mcp-session-id"] = this.sessionId;
    }
    if (this._streamMapping.get(this._standaloneSseStreamId) !== void 0) {
      res.writeHead(409).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Conflict: Only one SSE stream is allowed per session"
          },
          id: null
        })
      );
      return;
    }
    res.writeHead(200, headers).flushHeaders();
    this._streamMapping.set(this._standaloneSseStreamId, res);
    res.on("close", () => {
      this._streamMapping.delete(this._standaloneSseStreamId);
    });
    res.on("error", (error) => {
      this.onerror?.(error);
    });
  }
  /**
   * Replays events that would have been sent after the specified event ID
   * Only used when resumability is enabled
   */
  async replayEvents(lastEventId, res) {
    if (!this._eventStore) {
      return;
    }
    try {
      const headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      };
      if (this.sessionId !== void 0) {
        headers["mcp-session-id"] = this.sessionId;
      }
      res.writeHead(200, headers).flushHeaders();
      const streamId = await this._eventStore?.replayEventsAfter(lastEventId, {
        send: async (eventId, message) => {
          if (!this.writeSSEEvent(res, message, eventId)) {
            this.onerror?.(new Error("Failed replay events"));
            res.end();
          }
        }
      });
      this._streamMapping.set(streamId, res);
      res.on("error", (error) => {
        this.onerror?.(error);
      });
    } catch (error) {
      this.onerror?.(error);
    }
  }
  /**
   * Writes an event to the SSE stream with proper formatting
   */
  writeSSEEvent(res, message, eventId) {
    let eventData = `event: message
`;
    if (eventId) {
      eventData += `id: ${eventId}
`;
    }
    eventData += `data: ${JSON.stringify(message)}

`;
    return res.write(eventData);
  }
  /**
   * Handles unsupported requests (PUT, PATCH, etc.)
   */
  async handleUnsupportedRequest(res) {
    res.writeHead(405, {
      Allow: "GET, POST, DELETE"
    }).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32e3,
          message: "Method not allowed."
        },
        id: null
      })
    );
  }
  /**
   * Handles POST requests containing JSON-RPC messages
   */
  async handlePostRequest(req, res, parsedBody) {
    try {
      const acceptHeader = req.headers.accept;
      if (!acceptHeader?.includes("application/json") || !acceptHeader.includes("text/event-stream")) {
        res.writeHead(406).end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32e3,
              message: "Not Acceptable: Client must accept both application/json and text/event-stream"
            },
            id: null
          })
        );
        return;
      }
      const ct = req.headers["content-type"];
      if (!ct || !ct.includes("application/json")) {
        res.writeHead(415).end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32e3,
              message: "Unsupported Media Type: Content-Type must be application/json"
            },
            id: null
          })
        );
        return;
      }
      const authInfo = req.auth;
      const requestInfo = { headers: req.headers };
      let rawMessage;
      if (parsedBody !== void 0) {
        rawMessage = parsedBody;
      } else {
        const parsedCt = contentType.parse(ct);
        const body = await getRawBody(req, {
          limit: MAXIMUM_MESSAGE_SIZE,
          encoding: parsedCt.parameters.charset ?? "utf-8"
        });
        rawMessage = JSON.parse(body.toString());
      }
      let messages;
      if (Array.isArray(rawMessage)) {
        messages = rawMessage.map((msg) => JSONRPCMessageSchema.parse(msg));
      } else {
        messages = [JSONRPCMessageSchema.parse(rawMessage)];
      }
      const isInitializationRequest = messages.some(isInitializeRequest);
      if (isInitializationRequest) {
        if (this._initialized && this.sessionId !== void 0) {
          res.writeHead(400).end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32600,
                message: "Invalid Request: Server already initialized"
              },
              id: null
            })
          );
          return;
        }
        if (messages.length > 1) {
          res.writeHead(400).end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32600,
                message: "Invalid Request: Only one initialization request is allowed"
              },
              id: null
            })
          );
          return;
        }
        this.sessionId = this.sessionIdGenerator?.();
        this._initialized = true;
        if (this.sessionId && this._onsessioninitialized) {
          await Promise.resolve(this._onsessioninitialized(this.sessionId));
        }
      }
      if (!isInitializationRequest) {
        if (!this.validateSession(req, res)) {
          return;
        }
        if (!this.validateProtocolVersion(req, res)) {
          return;
        }
      }
      const hasRequests = messages.some(isJSONRPCRequest);
      if (!hasRequests) {
        res.writeHead(202).end();
        for (const message of messages) {
          this.onmessage?.(message, { authInfo, requestInfo });
        }
      } else if (hasRequests) {
        const streamId = randomUUID();
        if (!this._enableJsonResponse) {
          const headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
          };
          if (this.sessionId !== void 0) {
            headers["mcp-session-id"] = this.sessionId;
          }
          res.writeHead(200, headers);
        }
        for (const message of messages) {
          if (isJSONRPCRequest(message)) {
            this._streamMapping.set(streamId, res);
            this._requestToStreamMapping.set(message.id, streamId);
          }
        }
        res.on("close", () => {
          this._streamMapping.delete(streamId);
        });
        res.on("error", (error) => {
          this.onerror?.(error);
        });
        for (const message of messages) {
          this.onmessage?.(message, { authInfo, requestInfo });
        }
      }
    } catch (error) {
      res.writeHead(400).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
            data: String(error)
          },
          id: null
        })
      );
      this.onerror?.(error);
    }
  }
  /**
   * Handles DELETE requests to terminate sessions
   */
  async handleDeleteRequest(req, res) {
    if (!this.validateSession(req, res)) {
      return;
    }
    if (!this.validateProtocolVersion(req, res)) {
      return;
    }
    await Promise.resolve(this._onsessionclosed?.(this.sessionId));
    await this.close();
    res.writeHead(200).end();
  }
  /**
   * Validates session ID for non-initialization requests
   * Returns true if the session is valid, false otherwise
   */
  validateSession(req, res) {
    if (this.sessionIdGenerator === void 0) {
      return true;
    }
    if (!this._initialized) {
      res.writeHead(400).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Bad Request: Server not initialized"
          },
          id: null
        })
      );
      return false;
    }
    const sessionId = req.headers["mcp-session-id"];
    if (!sessionId) {
      res.writeHead(400).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Bad Request: Mcp-Session-Id header is required"
          },
          id: null
        })
      );
      return false;
    } else if (Array.isArray(sessionId)) {
      res.writeHead(400).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: "Bad Request: Mcp-Session-Id header must be a single value"
          },
          id: null
        })
      );
      return false;
    } else if (sessionId !== this.sessionId) {
      res.writeHead(404).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Session not found"
          },
          id: null
        })
      );
      return false;
    }
    return true;
  }
  validateProtocolVersion(req, res) {
    let protocolVersion = req.headers["mcp-protocol-version"] ?? DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
    if (Array.isArray(protocolVersion)) {
      protocolVersion = protocolVersion[protocolVersion.length - 1];
    }
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
      res.writeHead(400).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32e3,
            message: `Bad Request: Unsupported protocol version (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")})`
          },
          id: null
        })
      );
      return false;
    }
    return true;
  }
  async close() {
    this._streamMapping.forEach((response) => {
      response.end();
    });
    this._streamMapping.clear();
    this._requestResponseMap.clear();
    this.onclose?.();
  }
  async send(message, options) {
    let requestId = options?.relatedRequestId;
    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      requestId = message.id;
    }
    if (requestId === void 0) {
      if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
        throw new Error("Cannot send a response on a standalone SSE stream unless resuming a previous client request");
      }
      const standaloneSse = this._streamMapping.get(this._standaloneSseStreamId);
      if (standaloneSse === void 0) {
        return;
      }
      let eventId;
      if (this._eventStore) {
        eventId = await this._eventStore.storeEvent(this._standaloneSseStreamId, message);
      }
      this.writeSSEEvent(standaloneSse, message, eventId);
      return;
    }
    const streamId = this._requestToStreamMapping.get(requestId);
    const response = this._streamMapping.get(streamId);
    if (!streamId) {
      throw new Error(`No connection established for request ID: ${String(requestId)}`);
    }
    if (!this._enableJsonResponse) {
      let eventId;
      if (this._eventStore) {
        eventId = await this._eventStore.storeEvent(streamId, message);
      }
      if (response) {
        this.writeSSEEvent(response, message, eventId);
      }
    }
    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      this._requestResponseMap.set(requestId, message);
      const relatedIds = Array.from(this._requestToStreamMapping.entries()).filter(([_, streamId2]) => this._streamMapping.get(streamId2) === response).map(([id]) => id);
      const allResponsesReady = relatedIds.every((id) => this._requestResponseMap.has(id));
      if (allResponsesReady) {
        if (!response) {
          throw new Error(`No connection established for request ID: ${String(requestId)}`);
        }
        if (this._enableJsonResponse) {
          const headers = {
            "Content-Type": "application/json"
          };
          if (this.sessionId !== void 0) {
            headers["mcp-session-id"] = this.sessionId;
          }
          const responses = relatedIds.map((id) => this._requestResponseMap.get(id));
          response.writeHead(200, headers);
          if (responses.length === 1) {
            response.end(JSON.stringify(responses[0]));
          } else {
            response.end(JSON.stringify(responses));
          }
        } else {
          response.end();
        }
        for (const id of relatedIds) {
          this._requestResponseMap.delete(id);
          this._requestToStreamMapping.delete(id);
        }
      }
    }
  }
}
export {
  StreamableHTTPServerTransport
};
//# sourceMappingURL=streamableHttp.js.map
