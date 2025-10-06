"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const zod = require("zod");
const express = require("express");
const expressRateLimit = require("express-rate-limit");
const allowedMethods = require("../middleware/allowedMethods.js");
const errors = require("../errors.js");
const ClientAuthorizationParamsSchema = zod.z.object({
  client_id: zod.z.string(),
  redirect_uri: zod.z.string().optional().refine((value) => value === void 0 || URL.canParse(value), { message: "redirect_uri must be a valid URL" })
});
const RequestAuthorizationParamsSchema = zod.z.object({
  response_type: zod.z.literal("code"),
  code_challenge: zod.z.string(),
  code_challenge_method: zod.z.literal("S256"),
  scope: zod.z.string().optional(),
  state: zod.z.string().optional(),
  resource: zod.z.string().url().optional()
});
function authorizationHandler({ provider, rateLimit: rateLimitConfig }) {
  const router = express.Router();
  router.use(allowedMethods.allowedMethods(["GET", "POST"]));
  router.use(express.urlencoded({ extended: false }));
  if (rateLimitConfig !== false) {
    router.use(
      expressRateLimit.rateLimit({
        windowMs: 15 * 60 * 1e3,
        // 15 minutes
        max: 100,
        // 100 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: new errors.TooManyRequestsError("You have exceeded the rate limit for authorization requests").toResponseObject(),
        ...rateLimitConfig
      })
    );
  }
  router.all("/", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    let client_id, redirect_uri, client;
    try {
      const result = ClientAuthorizationParamsSchema.safeParse(req.method === "POST" ? req.body : req.query);
      if (!result.success) {
        throw new errors.InvalidRequestError(result.error.message);
      }
      client_id = result.data.client_id;
      redirect_uri = result.data.redirect_uri;
      client = await provider.clientsStore.getClient(client_id);
      if (!client) {
        throw new errors.InvalidClientError("Invalid client_id");
      }
      if (redirect_uri !== void 0) {
        if (!client.redirect_uris.includes(redirect_uri)) {
          throw new errors.InvalidRequestError("Unregistered redirect_uri");
        }
      } else if (client.redirect_uris.length === 1) {
        redirect_uri = client.redirect_uris[0];
      } else {
        throw new errors.InvalidRequestError("redirect_uri must be specified when client has multiple registered URIs");
      }
    } catch (error) {
      if (error instanceof errors.OAuthError) {
        const status = error instanceof errors.ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        const serverError = new errors.ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
      return;
    }
    let state;
    try {
      const parseResult = RequestAuthorizationParamsSchema.safeParse(req.method === "POST" ? req.body : req.query);
      if (!parseResult.success) {
        throw new errors.InvalidRequestError(parseResult.error.message);
      }
      const { scope, code_challenge, resource } = parseResult.data;
      state = parseResult.data.state;
      let requestedScopes = [];
      if (scope !== void 0) {
        requestedScopes = scope.split(" ");
        const allowedScopes = new Set(client.scope?.split(" "));
        for (const scope2 of requestedScopes) {
          if (!allowedScopes.has(scope2)) {
            throw new errors.InvalidScopeError(`Client was not registered with scope ${scope2}`);
          }
        }
      }
      await provider.authorize(
        client,
        {
          state,
          scopes: requestedScopes,
          redirectUri: redirect_uri,
          codeChallenge: code_challenge,
          resource: resource ? new URL(resource) : void 0
        },
        res
      );
    } catch (error) {
      if (error instanceof errors.OAuthError) {
        res.redirect(302, createErrorRedirect(redirect_uri, error, state));
      } else {
        const serverError = new errors.ServerError("Internal Server Error");
        res.redirect(302, createErrorRedirect(redirect_uri, serverError, state));
      }
    }
  });
  return router;
}
function createErrorRedirect(redirectUri, error, state) {
  const errorUrl = new URL(redirectUri);
  errorUrl.searchParams.set("error", error.errorCode);
  errorUrl.searchParams.set("error_description", error.message);
  if (error.errorUri) {
    errorUrl.searchParams.set("error_uri", error.errorUri);
  }
  if (state) {
    errorUrl.searchParams.set("state", state);
  }
  return errorUrl.href;
}
exports.authorizationHandler = authorizationHandler;
//# sourceMappingURL=authorize.js.map
