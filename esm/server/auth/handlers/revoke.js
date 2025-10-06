import express from "express";
import cors from "cors";
import { authenticateClient } from "../middleware/clientAuth.js";
import { OAuthTokenRevocationRequestSchema } from "../../../shared/auth.js";
import { rateLimit } from "express-rate-limit";
import { allowedMethods } from "../middleware/allowedMethods.js";
import { TooManyRequestsError, InvalidRequestError, ServerError, OAuthError } from "../errors.js";
function revocationHandler({ provider, rateLimit: rateLimitConfig }) {
  if (!provider.revokeToken) {
    throw new Error("Auth provider does not support revoking tokens");
  }
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
        message: new TooManyRequestsError("You have exceeded the rate limit for token revocation requests").toResponseObject(),
        ...rateLimitConfig
      })
    );
  }
  router.use(authenticateClient({ clientsStore: provider.clientsStore }));
  router.post("/", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const parseResult = OAuthTokenRevocationRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new InvalidRequestError(parseResult.error.message);
      }
      const client = req.client;
      if (!client) {
        throw new ServerError("Internal Server Error");
      }
      await provider.revokeToken(client, parseResult.data);
      res.status(200).json({});
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
  revocationHandler
};
//# sourceMappingURL=revoke.js.map
