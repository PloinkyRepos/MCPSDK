import { EventSource } from "eventsource";
import { JSONRPCMessageSchema } from "../types.js";
import { UnauthorizedError, auth, extractResourceMetadataUrl } from "./auth.js";
class SseError extends Error {
  constructor(code, message, event) {
    super(`SSE error: ${message}`);
    this.code = code;
    this.event = event;
  }
}
class SSEClientTransport {
  constructor(url, opts) {
    this._url = url;
    this._resourceMetadataUrl = void 0;
    this._eventSourceInit = opts?.eventSourceInit;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
    this._fetch = opts?.fetch;
  }
  async _authThenStart() {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }
    let result;
    try {
      result = await auth(this._authProvider, {
        serverUrl: this._url,
        resourceMetadataUrl: this._resourceMetadataUrl,
        fetchFn: this._fetch
      });
    } catch (error) {
      this.onerror?.(error);
      throw error;
    }
    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError();
    }
    return await this._startOrAuth();
  }
  async _commonHeaders() {
    const headers = {};
    if (this._authProvider) {
      const tokens = await this._authProvider.tokens();
      if (tokens) {
        headers["Authorization"] = `Bearer ${tokens.access_token}`;
      }
    }
    if (this._protocolVersion) {
      headers["mcp-protocol-version"] = this._protocolVersion;
    }
    return new Headers({ ...headers, ...this._requestInit?.headers });
  }
  _startOrAuth() {
    const fetchImpl = this?._eventSourceInit?.fetch ?? this._fetch ?? fetch;
    return new Promise((resolve, reject) => {
      this._eventSource = new EventSource(this._url.href, {
        ...this._eventSourceInit,
        fetch: async (url, init) => {
          const headers = await this._commonHeaders();
          headers.set("Accept", "text/event-stream");
          const response = await fetchImpl(url, {
            ...init,
            headers
          });
          if (response.status === 401 && response.headers.has("www-authenticate")) {
            this._resourceMetadataUrl = extractResourceMetadataUrl(response);
          }
          return response;
        }
      });
      this._abortController = new AbortController();
      this._eventSource.onerror = (event) => {
        if (event.code === 401 && this._authProvider) {
          this._authThenStart().then(resolve, reject);
          return;
        }
        const error = new SseError(event.code, event.message, event);
        reject(error);
        this.onerror?.(error);
      };
      this._eventSource.onopen = () => {
      };
      this._eventSource.addEventListener("endpoint", (event) => {
        const messageEvent = event;
        try {
          this._endpoint = new URL(messageEvent.data, this._url);
          if (this._endpoint.origin !== this._url.origin) {
            throw new Error(`Endpoint origin does not match connection origin: ${this._endpoint.origin}`);
          }
        } catch (error) {
          reject(error);
          this.onerror?.(error);
          void this.close();
          return;
        }
        resolve();
      });
      this._eventSource.onmessage = (event) => {
        const messageEvent = event;
        let message;
        try {
          message = JSONRPCMessageSchema.parse(JSON.parse(messageEvent.data));
        } catch (error) {
          this.onerror?.(error);
          return;
        }
        this.onmessage?.(message);
      };
    });
  }
  async start() {
    if (this._eventSource) {
      throw new Error("SSEClientTransport already started! If using Client class, note that connect() calls start() automatically.");
    }
    return await this._startOrAuth();
  }
  /**
   * Call this method after the user has finished authorizing via their user agent and is redirected back to the MCP client application. This will exchange the authorization code for an access token, enabling the next connection attempt to successfully auth.
   */
  async finishAuth(authorizationCode) {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }
    const result = await auth(this._authProvider, {
      serverUrl: this._url,
      authorizationCode,
      resourceMetadataUrl: this._resourceMetadataUrl,
      fetchFn: this._fetch
    });
    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError("Failed to authorize");
    }
  }
  async close() {
    this._abortController?.abort();
    this._eventSource?.close();
    this.onclose?.();
  }
  async send(message) {
    if (!this._endpoint) {
      throw new Error("Not connected");
    }
    try {
      const headers = await this._commonHeaders();
      headers.set("content-type", "application/json");
      const init = {
        ...this._requestInit,
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: this._abortController?.signal
      };
      const response = await (this._fetch ?? fetch)(this._endpoint, init);
      if (!response.ok) {
        if (response.status === 401 && this._authProvider) {
          this._resourceMetadataUrl = extractResourceMetadataUrl(response);
          const result = await auth(this._authProvider, {
            serverUrl: this._url,
            resourceMetadataUrl: this._resourceMetadataUrl,
            fetchFn: this._fetch
          });
          if (result !== "AUTHORIZED") {
            throw new UnauthorizedError();
          }
          return this.send(message);
        }
        const text = await response.text().catch(() => null);
        throw new Error(`Error POSTing to endpoint (HTTP ${response.status}): ${text}`);
      }
    } catch (error) {
      this.onerror?.(error);
      throw error;
    }
  }
  setProtocolVersion(version) {
    this._protocolVersion = version;
  }
}
export {
  SSEClientTransport,
  SseError
};
//# sourceMappingURL=sse.js.map
