"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const crypto = require("node:crypto");
const express = require("express");
const router = require("../../server/auth/router.js");
const authUtils = require("../../shared/auth-utils.js");
const errors = require("../../server/auth/errors.js");
class DemoInMemoryClientsStore {
  constructor() {
    this.clients = /* @__PURE__ */ new Map();
  }
  async getClient(clientId) {
    return this.clients.get(clientId);
  }
  async registerClient(clientMetadata) {
    this.clients.set(clientMetadata.client_id, clientMetadata);
    return clientMetadata;
  }
}
class DemoInMemoryAuthProvider {
  constructor(validateResource) {
    this.validateResource = validateResource;
    this.clientsStore = new DemoInMemoryClientsStore();
    this.codes = /* @__PURE__ */ new Map();
    this.tokens = /* @__PURE__ */ new Map();
  }
  async authorize(client, params, res) {
    const code = crypto.randomUUID();
    const searchParams = new URLSearchParams({
      code
    });
    if (params.state !== void 0) {
      searchParams.set("state", params.state);
    }
    this.codes.set(code, {
      client,
      params
    });
    if (!client.redirect_uris.includes(params.redirectUri)) {
      throw new errors.InvalidRequestError("Unregistered redirect_uri");
    }
    const targetUrl = new URL(params.redirectUri);
    targetUrl.search = searchParams.toString();
    res.redirect(targetUrl.toString());
  }
  async challengeForAuthorizationCode(client, authorizationCode) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) {
      throw new Error("Invalid authorization code");
    }
    return codeData.params.codeChallenge;
  }
  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier) {
    const codeData = this.codes.get(authorizationCode);
    if (!codeData) {
      throw new Error("Invalid authorization code");
    }
    if (codeData.client.client_id !== client.client_id) {
      throw new Error(`Authorization code was not issued to this client, ${codeData.client.client_id} != ${client.client_id}`);
    }
    if (this.validateResource && !this.validateResource(codeData.params.resource)) {
      throw new Error(`Invalid resource: ${codeData.params.resource}`);
    }
    this.codes.delete(authorizationCode);
    const token = crypto.randomUUID();
    const tokenData = {
      token,
      clientId: client.client_id,
      scopes: codeData.params.scopes || [],
      expiresAt: Date.now() + 36e5,
      // 1 hour
      resource: codeData.params.resource,
      type: "access"
    };
    this.tokens.set(token, tokenData);
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      scope: (codeData.params.scopes || []).join(" ")
    };
  }
  async exchangeRefreshToken(_client, _refreshToken, _scopes, _resource) {
    throw new Error("Not implemented for example demo");
  }
  async verifyAccessToken(token) {
    const tokenData = this.tokens.get(token);
    if (!tokenData || !tokenData.expiresAt || tokenData.expiresAt < Date.now()) {
      throw new Error("Invalid or expired token");
    }
    return {
      token,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes,
      expiresAt: Math.floor(tokenData.expiresAt / 1e3),
      resource: tokenData.resource
    };
  }
}
const setupAuthServer = ({
  authServerUrl,
  mcpServerUrl,
  strictResource
}) => {
  const validateResource = strictResource ? (resource) => {
    if (!resource) return false;
    const expectedResource = authUtils.resourceUrlFromServerUrl(mcpServerUrl);
    return resource.toString() === expectedResource.toString();
  } : void 0;
  const provider = new DemoInMemoryAuthProvider(validateResource);
  const authApp = express();
  authApp.use(express.json());
  authApp.use(express.urlencoded());
  authApp.use(
    router.mcpAuthRouter({
      provider,
      issuerUrl: authServerUrl,
      scopesSupported: ["mcp:tools"]
    })
  );
  authApp.post("/introspect", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ error: "Token is required" });
        return;
      }
      const tokenInfo = await provider.verifyAccessToken(token);
      res.json({
        active: true,
        client_id: tokenInfo.clientId,
        scope: tokenInfo.scopes.join(" "),
        exp: tokenInfo.expiresAt,
        aud: tokenInfo.resource
      });
      return;
    } catch (error) {
      res.status(401).json({
        active: false,
        error: "Unauthorized",
        error_description: `Invalid token: ${error}`
      });
    }
  });
  const auth_port = authServerUrl.port;
  authApp.listen(auth_port, (error) => {
    if (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
    console.log(`OAuth Authorization Server listening on port ${auth_port}`);
  });
  const oauthMetadata = router.createOAuthMetadata({
    provider,
    issuerUrl: authServerUrl,
    scopesSupported: ["mcp:tools"]
  });
  oauthMetadata.introspection_endpoint = new URL("/introspect", authServerUrl).href;
  return oauthMetadata;
};
exports.DemoInMemoryAuthProvider = DemoInMemoryAuthProvider;
exports.DemoInMemoryClientsStore = DemoInMemoryClientsStore;
exports.setupAuthServer = setupAuthServer;
//# sourceMappingURL=demoInMemoryOAuthProvider.js.map
