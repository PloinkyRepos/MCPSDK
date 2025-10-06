"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const express = require("express");
const auth = require("../../../shared/auth.js");
const crypto = require("node:crypto");
const cors = require("cors");
const expressRateLimit = require("express-rate-limit");
const allowedMethods = require("../middleware/allowedMethods.js");
const errors = require("../errors.js");
const DEFAULT_CLIENT_SECRET_EXPIRY_SECONDS = 30 * 24 * 60 * 60;
function clientRegistrationHandler({
  clientsStore,
  clientSecretExpirySeconds = DEFAULT_CLIENT_SECRET_EXPIRY_SECONDS,
  rateLimit: rateLimitConfig,
  clientIdGeneration = true
}) {
  if (!clientsStore.registerClient) {
    throw new Error("Client registration store does not support registering clients");
  }
  const router = express.Router();
  router.use(cors());
  router.use(allowedMethods.allowedMethods(["POST"]));
  router.use(express.json());
  if (rateLimitConfig !== false) {
    router.use(
      expressRateLimit.rateLimit({
        windowMs: 60 * 60 * 1e3,
        // 1 hour
        max: 20,
        // 20 requests per hour - stricter as registration is sensitive
        standardHeaders: true,
        legacyHeaders: false,
        message: new errors.TooManyRequestsError("You have exceeded the rate limit for client registration requests").toResponseObject(),
        ...rateLimitConfig
      })
    );
  }
  router.post("/", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const parseResult = auth.OAuthClientMetadataSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new errors.InvalidClientMetadataError(parseResult.error.message);
      }
      const clientMetadata = parseResult.data;
      const isPublicClient = clientMetadata.token_endpoint_auth_method === "none";
      const clientSecret = isPublicClient ? void 0 : crypto.randomBytes(32).toString("hex");
      const clientIdIssuedAt = Math.floor(Date.now() / 1e3);
      const clientsDoExpire = clientSecretExpirySeconds > 0;
      const secretExpiryTime = clientsDoExpire ? clientIdIssuedAt + clientSecretExpirySeconds : 0;
      const clientSecretExpiresAt = isPublicClient ? void 0 : secretExpiryTime;
      let clientInfo = {
        ...clientMetadata,
        client_secret: clientSecret,
        client_secret_expires_at: clientSecretExpiresAt
      };
      if (clientIdGeneration) {
        clientInfo.client_id = crypto.randomUUID();
        clientInfo.client_id_issued_at = clientIdIssuedAt;
      }
      clientInfo = await clientsStore.registerClient(clientInfo);
      res.status(201).json(clientInfo);
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
exports.clientRegistrationHandler = clientRegistrationHandler;
//# sourceMappingURL=register.js.map
