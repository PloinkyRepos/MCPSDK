import { z } from "zod";
import express from "express";
import cors from "cors";
import { verifyChallenge } from "pkce-challenge";
import { authenticateClient } from "../middleware/clientAuth.js";
import { rateLimit } from "express-rate-limit";
import { allowedMethods } from "../middleware/allowedMethods.js";
import { TooManyRequestsError, InvalidRequestError, ServerError, UnsupportedGrantTypeError, InvalidGrantError, OAuthError } from "../errors.js";
const TokenRequestSchema = z.object({
  grant_type: z.string()
});
const AuthorizationCodeGrantSchema = z.object({
  code: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.string().optional(),
  resource: z.string().url().optional()
});
const RefreshTokenGrantSchema = z.object({
  refresh_token: z.string(),
  scope: z.string().optional(),
  resource: z.string().url().optional()
});
function tokenHandler({ provider, rateLimit: rateLimitConfig }) {
  const router = express.Router();
  router.use(cors());
  router.use(allowedMethods(["POST"]));
  router.use(express.urlencoded({ extended: false }));
  if (rateLimitConfig !== false) {
    router.use(
      rateLimit({
        windowMs: 15 * 60 * 1e3,
        // 15 minutes
        max: 50,
        // 50 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: new TooManyRequestsError("You have exceeded the rate limit for token requests").toResponseObject(),
        ...rateLimitConfig
      })
    );
  }
  router.use(authenticateClient({ clientsStore: provider.clientsStore }));
  router.post("/", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const parseResult = TokenRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new InvalidRequestError(parseResult.error.message);
      }
      const { grant_type } = parseResult.data;
      const client = req.client;
      if (!client) {
        throw new ServerError("Internal Server Error");
      }
      switch (grant_type) {
        case "authorization_code": {
          const parseResult2 = AuthorizationCodeGrantSchema.safeParse(req.body);
          if (!parseResult2.success) {
            throw new InvalidRequestError(parseResult2.error.message);
          }
          const { code, code_verifier, redirect_uri, resource } = parseResult2.data;
          const skipLocalPkceValidation = provider.skipLocalPkceValidation;
          if (!skipLocalPkceValidation) {
            const codeChallenge = await provider.challengeForAuthorizationCode(client, code);
            if (!await verifyChallenge(code_verifier, codeChallenge)) {
              throw new InvalidGrantError("code_verifier does not match the challenge");
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
            throw new InvalidRequestError(parseResult2.error.message);
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
          throw new UnsupportedGrantTypeError("The grant type is not supported by this authorization server.");
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        const status = error instanceof ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        const serverError = new ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
    }
  });
  return router;
}
export {
  tokenHandler
};
//# sourceMappingURL=token.js.map
