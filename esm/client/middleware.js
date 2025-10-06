import { extractResourceMetadataUrl, auth, UnauthorizedError } from "./auth.js";
const withOAuth = (provider, baseUrl) => (next) => {
  return async (input, init) => {
    const makeRequest = async () => {
      const headers = new Headers(init?.headers);
      const tokens = await provider.tokens();
      if (tokens) {
        headers.set("Authorization", `Bearer ${tokens.access_token}`);
      }
      return await next(input, { ...init, headers });
    };
    let response = await makeRequest();
    if (response.status === 401) {
      try {
        const resourceMetadataUrl = extractResourceMetadataUrl(response);
        const serverUrl = baseUrl || (typeof input === "string" ? new URL(input).origin : input.origin);
        const result = await auth(provider, {
          serverUrl,
          resourceMetadataUrl,
          fetchFn: next
        });
        if (result === "REDIRECT") {
          throw new UnauthorizedError("Authentication requires user authorization - redirect initiated");
        }
        if (result !== "AUTHORIZED") {
          throw new UnauthorizedError(`Authentication failed with result: ${result}`);
        }
        response = await makeRequest();
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          throw error;
        }
        throw new UnauthorizedError(`Failed to re-authenticate: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (response.status === 401) {
      const url = typeof input === "string" ? input : input.toString();
      throw new UnauthorizedError(`Authentication failed for ${url}`);
    }
    return response;
  };
};
const withLogging = (options = {}) => {
  const { logger, includeRequestHeaders = false, includeResponseHeaders = false, statusLevel = 0 } = options;
  const defaultLogger = (input) => {
    const { method, url, status, statusText, duration, requestHeaders, responseHeaders, error } = input;
    let message = error ? `HTTP ${method} ${url} failed: ${error.message} (${duration}ms)` : `HTTP ${method} ${url} ${status} ${statusText} (${duration}ms)`;
    if (includeRequestHeaders && requestHeaders) {
      const reqHeaders = Array.from(requestHeaders.entries()).map(([key, value]) => `${key}: ${value}`).join(", ");
      message += `
  Request Headers: {${reqHeaders}}`;
    }
    if (includeResponseHeaders && responseHeaders) {
      const resHeaders = Array.from(responseHeaders.entries()).map(([key, value]) => `${key}: ${value}`).join(", ");
      message += `
  Response Headers: {${resHeaders}}`;
    }
    if (error || status >= 400) {
      console.error(message);
    } else {
      console.log(message);
    }
  };
  const logFn = logger || defaultLogger;
  return (next) => async (input, init) => {
    const startTime = performance.now();
    const method = init?.method || "GET";
    const url = typeof input === "string" ? input : input.toString();
    const requestHeaders = includeRequestHeaders ? new Headers(init?.headers) : void 0;
    try {
      const response = await next(input, init);
      const duration = performance.now() - startTime;
      if (response.status >= statusLevel) {
        logFn({
          method,
          url,
          status: response.status,
          statusText: response.statusText,
          duration,
          requestHeaders,
          responseHeaders: includeResponseHeaders ? response.headers : void 0
        });
      }
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      logFn({
        method,
        url,
        status: 0,
        statusText: "Network Error",
        duration,
        requestHeaders,
        error
      });
      throw error;
    }
  };
};
const applyMiddlewares = (...middleware) => {
  return (next) => {
    return middleware.reduce((handler, mw) => mw(handler), next);
  };
};
const createMiddleware = (handler) => {
  return (next) => (input, init) => handler(next, input, init);
};
export {
  applyMiddlewares,
  createMiddleware,
  withLogging,
  withOAuth
};
//# sourceMappingURL=middleware.js.map
