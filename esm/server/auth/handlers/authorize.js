import { z } from "zod";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { allowedMethods } from "../middleware/allowedMethods.js";
import { TooManyRequestsError, InvalidRequestError, InvalidClientError, OAuthError, ServerError, InvalidScopeError } from "../errors.js";
const ClientAuthorizationParamsSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().optional().refine((value) => value === void 0 || URL.canParse(value), { message: "redirect_uri must be a valid URL" })
});
const RequestAuthorizationParamsSchema = z.object({
  response_type: z.literal("code"),
  code_challenge: z.string(),
  code_challenge_method: z.literal("S256"),
  scope: z.string().optional(),
  state: z.string().optional(),
  resource: z.string().url().optional()
});
function authorizationHandler({ provider, rateLimit: rateLimitConfig }) {
  const router = express.Router();
  router.use(allowedMethods(["GET", "POST"]));
  router.use(express.urlencoded({ extended: false }));
  if (rateLimitConfig !== false) {
    router.use(
      rateLimit({
        windowMs: 15 * 60 * 1e3,
        // 15 minutes
        max: 100,
        // 100 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: new TooManyRequestsError("You have exceeded the rate limit for authorization requests").toResponseObject(),
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
        throw new InvalidRequestError(result.error.message);
      }
      client_id = result.data.client_id;
      redirect_uri = result.data.redirect_uri;
      client = await provider.clientsStore.getClient(client_id);
      if (!client) {
        throw new InvalidClientError("Invalid client_id");
      }
      if (redirect_uri !== void 0) {
        if (!client.redirect_uris.includes(redirect_uri)) {
          throw new InvalidRequestError("Unregistered redirect_uri");
        }
      } else if (client.redirect_uris.length === 1) {
        redirect_uri = client.redirect_uris[0];
      } else {
        throw new InvalidRequestError("redirect_uri must be specified when client has multiple registered URIs");
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        const serverError = new ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
      return;
    }
    let state;
    try {
      const parseResult = RequestAuthorizationParamsSchema.safeParse(req.method === "POST" ? req.body : req.query);
      if (!parseResult.success) {
        throw new InvalidRequestError(parseResult.error.message);
      }
      const { scope, code_challenge, resource } = parseResult.data;
      state = parseResult.data.state;
      let requestedScopes = [];
      if (scope !== void 0) {
        requestedScopes = scope.split(" ");
        const allowedScopes = new Set(client.scope?.split(" "));
        for (const scope2 of requestedScopes) {
          if (!allowedScopes.has(scope2)) {
            throw new InvalidScopeError(`Client was not registered with scope ${scope2}`);
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
      if (error instanceof OAuthError) {
        res.redirect(302, createErrorRedirect(redirect_uri, error, state));
      } else {
        const serverError = new ServerError("Internal Server Error");
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
export {
  authorizationHandler
};
//# sourceMappingURL=authorize.js.map
