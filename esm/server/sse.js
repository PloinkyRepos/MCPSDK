import { randomUUID } from "node:crypto";
import { JSONRPCMessageSchema } from "../types.js";
import getRawBody from "raw-body";
import contentType from "content-type";
import { URL } from "url";
const MAXIMUM_MESSAGE_SIZE = "4mb";
class SSEServerTransport {
  /**
   * Creates a new SSE server transport, which will direct the client to POST messages to the relative or absolute URL identified by `_endpoint`.
   */
  constructor(_endpoint, res, options) {
    this._endpoint = _endpoint;
    this.res = res;
    this._sessionId = randomUUID();
    this._options = options || { enableDnsRebindingProtection: false };
  }
  /**
   * Validates request headers for DNS rebinding protection.
   * @returns Error message if validation fails, undefined if validation passes.
   */
  validateRequestHeaders(req) {
    if (!this._options.enableDnsRebindingProtection) {
      return void 0;
    }
    if (this._options.allowedHosts && this._options.allowedHosts.length > 0) {
      const hostHeader = req.headers.host;
      if (!hostHeader || !this._options.allowedHosts.includes(hostHeader)) {
        return `Invalid Host header: ${hostHeader}`;
      }
    }
    if (this._options.allowedOrigins && this._options.allowedOrigins.length > 0) {
      const originHeader = req.headers.origin;
      if (!originHeader || !this._options.allowedOrigins.includes(originHeader)) {
        return `Invalid Origin header: ${originHeader}`;
      }
    }
    return void 0;
  }
  /**
   * Handles the initial SSE connection request.
   *
   * This should be called when a GET request is made to establish the SSE stream.
   */
  async start() {
    if (this._sseResponse) {
      throw new Error("SSEServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    }
    this.res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    const dummyBase = "http://localhost";
    const endpointUrl = new URL(this._endpoint, dummyBase);
    endpointUrl.searchParams.set("sessionId", this._sessionId);
    const relativeUrlWithSession = endpointUrl.pathname + endpointUrl.search + endpointUrl.hash;
    this.res.write(`event: endpoint
data: ${relativeUrlWithSession}

`);
    this._sseResponse = this.res;
    this.res.on("close", () => {
      this._sseResponse = void 0;
      this.onclose?.();
    });
  }
  /**
   * Handles incoming POST messages.
   *
   * This should be called when a POST request is made to send a message to the server.
   */
  async handlePostMessage(req, res, parsedBody) {
    if (!this._sseResponse) {
      const message = "SSE connection not established";
      res.writeHead(500).end(message);
      throw new Error(message);
    }
    const validationError = this.validateRequestHeaders(req);
    if (validationError) {
      res.writeHead(403).end(validationError);
      this.onerror?.(new Error(validationError));
      return;
    }
    const authInfo = req.auth;
    const requestInfo = { headers: req.headers };
    let body;
    try {
      const ct = contentType.parse(req.headers["content-type"] ?? "");
      if (ct.type !== "application/json") {
        throw new Error(`Unsupported content-type: ${ct.type}`);
      }
      body = parsedBody ?? await getRawBody(req, {
        limit: MAXIMUM_MESSAGE_SIZE,
        encoding: ct.parameters.charset ?? "utf-8"
      });
    } catch (error) {
      res.writeHead(400).end(String(error));
      this.onerror?.(error);
      return;
    }
    try {
      await this.handleMessage(typeof body === "string" ? JSON.parse(body) : body, { requestInfo, authInfo });
    } catch {
      res.writeHead(400).end(`Invalid message: ${body}`);
      return;
    }
    res.writeHead(202).end("Accepted");
  }
  /**
   * Handle a client message, regardless of how it arrived. This can be used to inform the server of messages that arrive via a means different than HTTP POST.
   */
  async handleMessage(message, extra) {
    let parsedMessage;
    try {
      parsedMessage = JSONRPCMessageSchema.parse(message);
    } catch (error) {
      this.onerror?.(error);
      throw error;
    }
    this.onmessage?.(parsedMessage, extra);
  }
  async close() {
    this._sseResponse?.end();
    this._sseResponse = void 0;
    this.onclose?.();
  }
  async send(message) {
    if (!this._sseResponse) {
      throw new Error("Not connected");
    }
    this._sseResponse.write(`event: message
data: ${JSON.stringify(message)}

`);
  }
  /**
   * Returns the session ID for this transport.
   *
   * This can be used to route incoming POST requests.
   */
  get sessionId() {
    return this._sessionId;
  }
}
export {
  SSEServerTransport
};
//# sourceMappingURL=sse.js.map
