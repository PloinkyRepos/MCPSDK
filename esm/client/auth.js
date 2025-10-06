import pkceChallenge from "pkce-challenge";
import { LATEST_PROTOCOL_VERSION } from "../types.js";
import { OAuthErrorResponseSchema, OAuthProtectedResourceMetadataSchema, OAuthMetadataSchema, OpenIdProviderDiscoveryMetadataSchema, OAuthTokensSchema, OAuthClientInformationFullSchema } from "../shared/auth.js";
import { resourceUrlFromServerUrl, checkResourceAllowed } from "../shared/auth-utils.js";
import { OAUTH_ERRORS, ServerError, InvalidClientError, UnauthorizedClientError, InvalidGrantError, OAuthError } from "../server/auth/errors.js";
class UnauthorizedError extends Error {
  constructor(message) {
    super(message ?? "Unauthorized");
  }
}
function selectClientAuthMethod(clientInformation, supportedMethods) {
  const hasClientSecret = clientInformation.client_secret !== void 0;
  if (supportedMethods.length === 0) {
    return hasClientSecret ? "client_secret_post" : "none";
  }
  if (hasClientSecret && supportedMethods.includes("client_secret_basic")) {
    return "client_secret_basic";
  }
  if (hasClientSecret && supportedMethods.includes("client_secret_post")) {
    return "client_secret_post";
  }
  if (supportedMethods.includes("none")) {
    return "none";
  }
  return hasClientSecret ? "client_secret_post" : "none";
}
function applyClientAuthentication(method, clientInformation, headers, params) {
  const { client_id, client_secret } = clientInformation;
  switch (method) {
    case "client_secret_basic":
      applyBasicAuth(client_id, client_secret, headers);
      return;
    case "client_secret_post":
      applyPostAuth(client_id, client_secret, params);
      return;
    case "none":
      applyPublicAuth(client_id, params);
      return;
    default:
      throw new Error(`Unsupported client authentication method: ${method}`);
  }
}
function applyBasicAuth(clientId, clientSecret, headers) {
  if (!clientSecret) {
    throw new Error("client_secret_basic authentication requires a client_secret");
  }
  const credentials = btoa(`${clientId}:${clientSecret}`);
  headers.set("Authorization", `Basic ${credentials}`);
}
function applyPostAuth(clientId, clientSecret, params) {
  params.set("client_id", clientId);
  if (clientSecret) {
    params.set("client_secret", clientSecret);
  }
}
function applyPublicAuth(clientId, params) {
  params.set("client_id", clientId);
}
async function parseErrorResponse(input) {
  const statusCode = input instanceof Response ? input.status : void 0;
  const body = input instanceof Response ? await input.text() : input;
  try {
    const result = OAuthErrorResponseSchema.parse(JSON.parse(body));
    const { error, error_description, error_uri } = result;
    const errorClass = OAUTH_ERRORS[error] || ServerError;
    return new errorClass(error_description || "", error_uri);
  } catch (error) {
    const errorMessage = `${statusCode ? `HTTP ${statusCode}: ` : ""}Invalid OAuth error response: ${error}. Raw body: ${body}`;
    return new ServerError(errorMessage);
  }
}
async function auth(provider, options) {
  try {
    return await authInternal(provider, options);
  } catch (error) {
    if (error instanceof InvalidClientError || error instanceof UnauthorizedClientError) {
      await provider.invalidateCredentials?.("all");
      return await authInternal(provider, options);
    } else if (error instanceof InvalidGrantError) {
      await provider.invalidateCredentials?.("tokens");
      return await authInternal(provider, options);
    }
    throw error;
  }
}
async function authInternal(provider, {
  serverUrl,
  authorizationCode,
  scope,
  resourceMetadataUrl,
  fetchFn
}) {
  let resourceMetadata;
  let authorizationServerUrl;
  try {
    resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl, { resourceMetadataUrl }, fetchFn);
    if (resourceMetadata.authorization_servers && resourceMetadata.authorization_servers.length > 0) {
      authorizationServerUrl = resourceMetadata.authorization_servers[0];
    }
  } catch {
  }
  if (!authorizationServerUrl) {
    authorizationServerUrl = serverUrl;
  }
  const resource = await selectResourceURL(serverUrl, provider, resourceMetadata);
  const metadata = await discoverAuthorizationServerMetadata(authorizationServerUrl, {
    fetchFn
  });
  let clientInformation = await Promise.resolve(provider.clientInformation());
  if (!clientInformation) {
    if (authorizationCode !== void 0) {
      throw new Error("Existing OAuth client information is required when exchanging an authorization code");
    }
    if (!provider.saveClientInformation) {
      throw new Error("OAuth client information must be saveable for dynamic registration");
    }
    const fullInformation = await registerClient(authorizationServerUrl, {
      metadata,
      clientMetadata: provider.clientMetadata,
      fetchFn
    });
    await provider.saveClientInformation(fullInformation);
    clientInformation = fullInformation;
  }
  if (authorizationCode !== void 0) {
    const codeVerifier2 = await provider.codeVerifier();
    const tokens2 = await exchangeAuthorization(authorizationServerUrl, {
      metadata,
      clientInformation,
      authorizationCode,
      codeVerifier: codeVerifier2,
      redirectUri: provider.redirectUrl,
      resource,
      addClientAuthentication: provider.addClientAuthentication,
      fetchFn
    });
    await provider.saveTokens(tokens2);
    return "AUTHORIZED";
  }
  const tokens = await provider.tokens();
  if (tokens?.refresh_token) {
    try {
      const newTokens = await refreshAuthorization(authorizationServerUrl, {
        metadata,
        clientInformation,
        refreshToken: tokens.refresh_token,
        resource,
        addClientAuthentication: provider.addClientAuthentication,
        fetchFn
      });
      await provider.saveTokens(newTokens);
      return "AUTHORIZED";
    } catch (error) {
      if (!(error instanceof OAuthError) || error instanceof ServerError) {
      } else {
        throw error;
      }
    }
  }
  const state = provider.state ? await provider.state() : void 0;
  const { authorizationUrl, codeVerifier } = await startAuthorization(authorizationServerUrl, {
    metadata,
    clientInformation,
    state,
    redirectUrl: provider.redirectUrl,
    scope: scope || provider.clientMetadata.scope,
    resource
  });
  await provider.saveCodeVerifier(codeVerifier);
  await provider.redirectToAuthorization(authorizationUrl);
  return "REDIRECT";
}
async function selectResourceURL(serverUrl, provider, resourceMetadata) {
  const defaultResource = resourceUrlFromServerUrl(serverUrl);
  if (provider.validateResourceURL) {
    return await provider.validateResourceURL(defaultResource, resourceMetadata?.resource);
  }
  if (!resourceMetadata) {
    return void 0;
  }
  if (!checkResourceAllowed({ requestedResource: defaultResource, configuredResource: resourceMetadata.resource })) {
    throw new Error(`Protected resource ${resourceMetadata.resource} does not match expected ${defaultResource} (or origin)`);
  }
  return new URL(resourceMetadata.resource);
}
function extractResourceMetadataUrl(res) {
  const authenticateHeader = res.headers.get("WWW-Authenticate");
  if (!authenticateHeader) {
    return void 0;
  }
  const [type, scheme] = authenticateHeader.split(" ");
  if (type.toLowerCase() !== "bearer" || !scheme) {
    return void 0;
  }
  const regex = /resource_metadata="([^"]*)"/;
  const match = regex.exec(authenticateHeader);
  if (!match) {
    return void 0;
  }
  try {
    return new URL(match[1]);
  } catch {
    return void 0;
  }
}
async function discoverOAuthProtectedResourceMetadata(serverUrl, opts, fetchFn = fetch) {
  const response = await discoverMetadataWithFallback(serverUrl, "oauth-protected-resource", fetchFn, {
    protocolVersion: opts?.protocolVersion,
    metadataUrl: opts?.resourceMetadataUrl
  });
  if (!response || response.status === 404) {
    throw new Error(`Resource server does not implement OAuth 2.0 Protected Resource Metadata.`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} trying to load well-known OAuth protected resource metadata.`);
  }
  return OAuthProtectedResourceMetadataSchema.parse(await response.json());
}
async function fetchWithCorsRetry(url, headers, fetchFn = fetch) {
  try {
    return await fetchFn(url, { headers });
  } catch (error) {
    if (error instanceof TypeError) {
      if (headers) {
        return fetchWithCorsRetry(url, void 0, fetchFn);
      } else {
        return void 0;
      }
    }
    throw error;
  }
}
function buildWellKnownPath(wellKnownPrefix, pathname = "", options = {}) {
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return options.prependPathname ? `${pathname}/.well-known/${wellKnownPrefix}` : `/.well-known/${wellKnownPrefix}${pathname}`;
}
async function tryMetadataDiscovery(url, protocolVersion, fetchFn = fetch) {
  const headers = {
    "MCP-Protocol-Version": protocolVersion
  };
  return await fetchWithCorsRetry(url, headers, fetchFn);
}
function shouldAttemptFallback(response, pathname) {
  return !response || response.status >= 400 && response.status < 500 && pathname !== "/";
}
async function discoverMetadataWithFallback(serverUrl, wellKnownType, fetchFn, opts) {
  const issuer = new URL(serverUrl);
  const protocolVersion = opts?.protocolVersion ?? LATEST_PROTOCOL_VERSION;
  let url;
  if (opts?.metadataUrl) {
    url = new URL(opts.metadataUrl);
  } else {
    const wellKnownPath = buildWellKnownPath(wellKnownType, issuer.pathname);
    url = new URL(wellKnownPath, opts?.metadataServerUrl ?? issuer);
    url.search = issuer.search;
  }
  let response = await tryMetadataDiscovery(url, protocolVersion, fetchFn);
  if (!opts?.metadataUrl && shouldAttemptFallback(response, issuer.pathname)) {
    const rootUrl = new URL(`/.well-known/${wellKnownType}`, issuer);
    response = await tryMetadataDiscovery(rootUrl, protocolVersion, fetchFn);
  }
  return response;
}
async function discoverOAuthMetadata(issuer, {
  authorizationServerUrl,
  protocolVersion
} = {}, fetchFn = fetch) {
  if (typeof issuer === "string") {
    issuer = new URL(issuer);
  }
  if (!authorizationServerUrl) {
    authorizationServerUrl = issuer;
  }
  if (typeof authorizationServerUrl === "string") {
    authorizationServerUrl = new URL(authorizationServerUrl);
  }
  protocolVersion ??= LATEST_PROTOCOL_VERSION;
  const response = await discoverMetadataWithFallback(authorizationServerUrl, "oauth-authorization-server", fetchFn, {
    protocolVersion,
    metadataServerUrl: authorizationServerUrl
  });
  if (!response || response.status === 404) {
    return void 0;
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} trying to load well-known OAuth metadata`);
  }
  return OAuthMetadataSchema.parse(await response.json());
}
function buildDiscoveryUrls(authorizationServerUrl) {
  const url = typeof authorizationServerUrl === "string" ? new URL(authorizationServerUrl) : authorizationServerUrl;
  const hasPath = url.pathname !== "/";
  const urlsToTry = [];
  if (!hasPath) {
    urlsToTry.push({
      url: new URL("/.well-known/oauth-authorization-server", url.origin),
      type: "oauth"
    });
    urlsToTry.push({
      url: new URL(`/.well-known/openid-configuration`, url.origin),
      type: "oidc"
    });
    return urlsToTry;
  }
  let pathname = url.pathname;
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  urlsToTry.push({
    url: new URL(`/.well-known/oauth-authorization-server${pathname}`, url.origin),
    type: "oauth"
  });
  urlsToTry.push({
    url: new URL("/.well-known/oauth-authorization-server", url.origin),
    type: "oauth"
  });
  urlsToTry.push({
    url: new URL(`/.well-known/openid-configuration${pathname}`, url.origin),
    type: "oidc"
  });
  urlsToTry.push({
    url: new URL(`${pathname}/.well-known/openid-configuration`, url.origin),
    type: "oidc"
  });
  return urlsToTry;
}
async function discoverAuthorizationServerMetadata(authorizationServerUrl, {
  fetchFn = fetch,
  protocolVersion = LATEST_PROTOCOL_VERSION
} = {}) {
  const headers = { "MCP-Protocol-Version": protocolVersion };
  const urlsToTry = buildDiscoveryUrls(authorizationServerUrl);
  for (const { url: endpointUrl, type } of urlsToTry) {
    const response = await fetchWithCorsRetry(endpointUrl, headers, fetchFn);
    if (!response) {
      continue;
    }
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        continue;
      }
      throw new Error(
        `HTTP ${response.status} trying to load ${type === "oauth" ? "OAuth" : "OpenID provider"} metadata from ${endpointUrl}`
      );
    }
    if (type === "oauth") {
      return OAuthMetadataSchema.parse(await response.json());
    } else {
      const metadata = OpenIdProviderDiscoveryMetadataSchema.parse(await response.json());
      if (!metadata.code_challenge_methods_supported?.includes("S256")) {
        throw new Error(
          `Incompatible OIDC provider at ${endpointUrl}: does not support S256 code challenge method required by MCP specification`
        );
      }
      return metadata;
    }
  }
  return void 0;
}
async function startAuthorization(authorizationServerUrl, {
  metadata,
  clientInformation,
  redirectUrl,
  scope,
  state,
  resource
}) {
  const responseType = "code";
  const codeChallengeMethod = "S256";
  let authorizationUrl;
  if (metadata) {
    authorizationUrl = new URL(metadata.authorization_endpoint);
    if (!metadata.response_types_supported.includes(responseType)) {
      throw new Error(`Incompatible auth server: does not support response type ${responseType}`);
    }
    if (!metadata.code_challenge_methods_supported || !metadata.code_challenge_methods_supported.includes(codeChallengeMethod)) {
      throw new Error(`Incompatible auth server: does not support code challenge method ${codeChallengeMethod}`);
    }
  } else {
    authorizationUrl = new URL("/authorize", authorizationServerUrl);
  }
  const challenge = await pkceChallenge();
  const codeVerifier = challenge.code_verifier;
  const codeChallenge = challenge.code_challenge;
  authorizationUrl.searchParams.set("response_type", responseType);
  authorizationUrl.searchParams.set("client_id", clientInformation.client_id);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
  authorizationUrl.searchParams.set("redirect_uri", String(redirectUrl));
  if (state) {
    authorizationUrl.searchParams.set("state", state);
  }
  if (scope) {
    authorizationUrl.searchParams.set("scope", scope);
  }
  if (scope?.includes("offline_access")) {
    authorizationUrl.searchParams.append("prompt", "consent");
  }
  if (resource) {
    authorizationUrl.searchParams.set("resource", resource.href);
  }
  return { authorizationUrl, codeVerifier };
}
async function exchangeAuthorization(authorizationServerUrl, {
  metadata,
  clientInformation,
  authorizationCode,
  codeVerifier,
  redirectUri,
  resource,
  addClientAuthentication,
  fetchFn
}) {
  const grantType = "authorization_code";
  const tokenUrl = metadata?.token_endpoint ? new URL(metadata.token_endpoint) : new URL("/token", authorizationServerUrl);
  if (metadata?.grant_types_supported && !metadata.grant_types_supported.includes(grantType)) {
    throw new Error(`Incompatible auth server: does not support grant type ${grantType}`);
  }
  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json"
  });
  const params = new URLSearchParams({
    grant_type: grantType,
    code: authorizationCode,
    code_verifier: codeVerifier,
    redirect_uri: String(redirectUri)
  });
  if (addClientAuthentication) {
    addClientAuthentication(headers, params, authorizationServerUrl, metadata);
  } else {
    const supportedMethods = metadata?.token_endpoint_auth_methods_supported ?? [];
    const authMethod = selectClientAuthMethod(clientInformation, supportedMethods);
    applyClientAuthentication(authMethod, clientInformation, headers, params);
  }
  if (resource) {
    params.set("resource", resource.href);
  }
  const response = await (fetchFn ?? fetch)(tokenUrl, {
    method: "POST",
    headers,
    body: params
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return OAuthTokensSchema.parse(await response.json());
}
async function refreshAuthorization(authorizationServerUrl, {
  metadata,
  clientInformation,
  refreshToken,
  resource,
  addClientAuthentication,
  fetchFn
}) {
  const grantType = "refresh_token";
  let tokenUrl;
  if (metadata) {
    tokenUrl = new URL(metadata.token_endpoint);
    if (metadata.grant_types_supported && !metadata.grant_types_supported.includes(grantType)) {
      throw new Error(`Incompatible auth server: does not support grant type ${grantType}`);
    }
  } else {
    tokenUrl = new URL("/token", authorizationServerUrl);
  }
  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded"
  });
  const params = new URLSearchParams({
    grant_type: grantType,
    refresh_token: refreshToken
  });
  if (addClientAuthentication) {
    addClientAuthentication(headers, params, authorizationServerUrl, metadata);
  } else {
    const supportedMethods = metadata?.token_endpoint_auth_methods_supported ?? [];
    const authMethod = selectClientAuthMethod(clientInformation, supportedMethods);
    applyClientAuthentication(authMethod, clientInformation, headers, params);
  }
  if (resource) {
    params.set("resource", resource.href);
  }
  const response = await (fetchFn ?? fetch)(tokenUrl, {
    method: "POST",
    headers,
    body: params
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return OAuthTokensSchema.parse({ refresh_token: refreshToken, ...await response.json() });
}
async function registerClient(authorizationServerUrl, {
  metadata,
  clientMetadata,
  fetchFn
}) {
  let registrationUrl;
  if (metadata) {
    if (!metadata.registration_endpoint) {
      throw new Error("Incompatible auth server: does not support dynamic client registration");
    }
    registrationUrl = new URL(metadata.registration_endpoint);
  } else {
    registrationUrl = new URL("/register", authorizationServerUrl);
  }
  const response = await (fetchFn ?? fetch)(registrationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(clientMetadata)
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }
  return OAuthClientInformationFullSchema.parse(await response.json());
}
export {
  UnauthorizedError,
  auth,
  buildDiscoveryUrls,
  discoverAuthorizationServerMetadata,
  discoverOAuthMetadata,
  discoverOAuthProtectedResourceMetadata,
  exchangeAuthorization,
  extractResourceMetadataUrl,
  parseErrorResponse,
  refreshAuthorization,
  registerClient,
  selectResourceURL,
  startAuthorization
};
//# sourceMappingURL=auth.js.map
