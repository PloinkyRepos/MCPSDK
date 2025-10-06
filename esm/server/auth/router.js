import express from "express";
import { clientRegistrationHandler } from "./handlers/register.js";
import { tokenHandler } from "./handlers/token.js";
import { authorizationHandler } from "./handlers/authorize.js";
import { revocationHandler } from "./handlers/revoke.js";
import { metadataHandler } from "./handlers/metadata.js";
const checkIssuerUrl = (issuer) => {
  if (issuer.protocol !== "https:" && issuer.hostname !== "localhost" && issuer.hostname !== "127.0.0.1") {
    throw new Error("Issuer URL must be HTTPS");
  }
  if (issuer.hash) {
    throw new Error(`Issuer URL must not have a fragment: ${issuer}`);
  }
  if (issuer.search) {
    throw new Error(`Issuer URL must not have a query string: ${issuer}`);
  }
};
const createOAuthMetadata = (options) => {
  const issuer = options.issuerUrl;
  const baseUrl = options.baseUrl;
  checkIssuerUrl(issuer);
  const authorization_endpoint = "/authorize";
  const token_endpoint = "/token";
  const registration_endpoint = options.provider.clientsStore.registerClient ? "/register" : void 0;
  const revocation_endpoint = options.provider.revokeToken ? "/revoke" : void 0;
  const metadata = {
    issuer: issuer.href,
    service_documentation: options.serviceDocumentationUrl?.href,
    authorization_endpoint: new URL(authorization_endpoint, baseUrl || issuer).href,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint: new URL(token_endpoint, baseUrl || issuer).href,
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: options.scopesSupported,
    revocation_endpoint: revocation_endpoint ? new URL(revocation_endpoint, baseUrl || issuer).href : void 0,
    revocation_endpoint_auth_methods_supported: revocation_endpoint ? ["client_secret_post"] : void 0,
    registration_endpoint: registration_endpoint ? new URL(registration_endpoint, baseUrl || issuer).href : void 0
  };
  return metadata;
};
function mcpAuthRouter(options) {
  const oauthMetadata = createOAuthMetadata(options);
  const router = express.Router();
  router.use(
    new URL(oauthMetadata.authorization_endpoint).pathname,
    authorizationHandler({ provider: options.provider, ...options.authorizationOptions })
  );
  router.use(new URL(oauthMetadata.token_endpoint).pathname, tokenHandler({ provider: options.provider, ...options.tokenOptions }));
  router.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      // Prefer explicit RS; otherwise fall back to AS baseUrl, then to issuer (back-compat)
      resourceServerUrl: options.resourceServerUrl ?? options.baseUrl ?? new URL(oauthMetadata.issuer),
      serviceDocumentationUrl: options.serviceDocumentationUrl,
      scopesSupported: options.scopesSupported,
      resourceName: options.resourceName
    })
  );
  if (oauthMetadata.registration_endpoint) {
    router.use(
      new URL(oauthMetadata.registration_endpoint).pathname,
      clientRegistrationHandler({
        clientsStore: options.provider.clientsStore,
        ...options.clientRegistrationOptions
      })
    );
  }
  if (oauthMetadata.revocation_endpoint) {
    router.use(
      new URL(oauthMetadata.revocation_endpoint).pathname,
      revocationHandler({ provider: options.provider, ...options.revocationOptions })
    );
  }
  return router;
}
function mcpAuthMetadataRouter(options) {
  checkIssuerUrl(new URL(options.oauthMetadata.issuer));
  const router = express.Router();
  const protectedResourceMetadata = {
    resource: options.resourceServerUrl.href,
    authorization_servers: [options.oauthMetadata.issuer],
    scopes_supported: options.scopesSupported,
    resource_name: options.resourceName,
    resource_documentation: options.serviceDocumentationUrl?.href
  };
  const rsPath = new URL(options.resourceServerUrl.href).pathname;
  router.use(`/.well-known/oauth-protected-resource${rsPath === "/" ? "" : rsPath}`, metadataHandler(protectedResourceMetadata));
  router.use("/.well-known/oauth-authorization-server", metadataHandler(options.oauthMetadata));
  return router;
}
function getOAuthProtectedResourceMetadataUrl(serverUrl) {
  const u = new URL(serverUrl.href);
  const rsPath = u.pathname && u.pathname !== "/" ? u.pathname : "";
  return new URL(`/.well-known/oauth-protected-resource${rsPath}`, u).href;
}
export {
  createOAuthMetadata,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
  mcpAuthRouter
};
//# sourceMappingURL=router.js.map
