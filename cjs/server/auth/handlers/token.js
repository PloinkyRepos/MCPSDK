"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const zod = require("zod");
const express = require("express");
const cors = require("cors");
const pkceChallenge = require("pkce-challenge");
const clientAuth = require("../middleware/clientAuth.js");
const expressRateLimit = require("express-rate-limit");
const allowedMethods = require("../middleware/allowedMethods.js");
const errors = require("../errors.js");
const TokenRequestSchema = zod.z.object({
  grant_type: zod.z.string()
});
const AuthorizationCodeGrantSchema = zod.z.object({
  code: zod.z.string(),
  code_verifier: zod.z.string(),
  redirect_uri: zod.z.string().optional(),
  resource: zod.z.string().url().optional()
});
const RefreshTokenGrantSchema = zod.z.object({
  refresh_token: zod.z.string(),
  scope: zod.z.string().optional(),
  resource: zod.z.string().url().optional()
});
function tokenHandler({ provider, rateLimit: rateLimitConfig }) {
  const router = express.Router();
  router.use(cors());
  router.use(allowedMethods.allowedMethods(["POST"]));
  router.use(express.urlencoded({ extended: false }));
  if (rateLimitConfig !== false) {
    router.use(
      expressRateLimit.rateLimit({
        windowMs: 15 * 60 * 1e3,
        // 15 minutes
        max: 50,
        // 50 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: new errors.TooManyRequestsError("You have exceeded the rate limit for token requests").toResponseObject(),
        ...rateLimitConfig
      })
    );
  }
  router.use(clientAuth.authenticateClient({ clientsStore: provider.clientsStore }));
  router.post("/", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const parseResult = TokenRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new errors.InvalidRequestError(parseResult.error.message);
      }
      const { grant_type } = parseResult.data;
      const client = req.client;
      if (!client) {
        throw new errors.ServerError("Internal Server Error");
      }
      switch (grant_type) {
        case "authorization_code": {
          const parseResult2 = AuthorizationCodeGrantSchema.safeParse(req.body);
          if (!parseResult2.success) {
            throw new errors.InvalidRequestError(parseResult2.error.message);
          }
          const { code, code_verifier, redirect_uri, resource } = parseResult2.data;
          const skipLocalPkceValidation = provider.skipLocalPkceValidation;
          if (!skipLocalPkceValidation) {
            const codeChallenge = await provider.challengeForAuthorizationCode(client, code);
            if (!await pkceChallenge.verifyChallenge(code_verifier, codeChallenge)) {
              throw new errors.InvalidGrantError("code_verifier does not match the challenge");
            }
          }
          const tokens = await provider.exchangeAuthorizationCode(
            client,
            code,
            skipLocalPkceValidation ? code_verifier : void 0,
            redirect_uri,
            resource ? new URL(resource) : void 0
          );
          res.status(200).json(tokens);
          break;
        }
        case "refresh_token": {
          const parseResult2 = RefreshTokenGrantSchema.safeParse(req.body);
          if (!parseResult2.success) {
            throw new errors.InvalidRequestError(parseResult2.error.message);
          }
          const { refresh_token, scope, resource } = parseResult2.data;
          const scopes = scope?.split(" ");
          const tokens = await provider.exchangeRefreshToken(
            client,
            refresh_token,
            scopes,
            resource ? new URL(resource) : void 0
          );
          res.status(200).json(tokens);
          break;
        }
        default:
          throw new errors.UnsupportedGrantTypeError("The grant type is not supported by this authorization server.");
      }
    } catch (error) {
      if (error instanceof errors.OAuthError) {
        const status = error instanceof errors.ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        const serverError = new errors.ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
    }
  });
  return router;
}
exports.tokenHandler = tokenHandler;
//# sourceMappingURL=token.js.map
