"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const express = require("express");
const cors = require("cors");
const clientAuth = require("../middleware/clientAuth.js");
const auth = require("../../../shared/auth.js");
const expressRateLimit = require("express-rate-limit");
const allowedMethods = require("../middleware/allowedMethods.js");
const errors = require("../errors.js");
function revocationHandler({ provider, rateLimit: rateLimitConfig }) {
  if (!provider.revokeToken) {
    throw new Error("Auth provider does not support revoking tokens");
  }
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
        message: new errors.TooManyRequestsError("You have exceeded the rate limit for token revocation requests").toResponseObject(),
        ...rateLimitConfig
      })
    );
  }
  router.use(clientAuth.authenticateClient({ clientsStore: provider.clientsStore }));
  router.post("/", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const parseResult = auth.OAuthTokenRevocationRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new errors.InvalidRequestError(parseResult.error.message);
      }
      const client = req.client;
      if (!client) {
        throw new errors.ServerError("Internal Server Error");
      }
      await provider.revokeToken(client, parseResult.data);
      res.status(200).json({});
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
exports.revocationHandler = revocationHandler;
//# sourceMappingURL=revoke.js.map
