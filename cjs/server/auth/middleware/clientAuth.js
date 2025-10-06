"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const zod = require("zod");
const errors = require("../errors.js");
const ClientAuthenticatedRequestSchema = zod.z.object({
  client_id: zod.z.string(),
  client_secret: zod.z.string().optional()
});
function authenticateClient({ clientsStore }) {
  return async (req, res, next) => {
    try {
      const result = ClientAuthenticatedRequestSchema.safeParse(req.body);
      if (!result.success) {
        throw new errors.InvalidRequestError(String(result.error));
      }
      const { client_id, client_secret } = result.data;
      const client = await clientsStore.getClient(client_id);
      if (!client) {
        throw new errors.InvalidClientError("Invalid client_id");
      }
      if (client.client_secret) {
        if (!client_secret) {
          throw new errors.InvalidClientError("Client secret is required");
        }
        if (client.client_secret !== client_secret) {
          throw new errors.InvalidClientError("Invalid client_secret");
        }
        if (client.client_secret_expires_at && client.client_secret_expires_at < Math.floor(Date.now() / 1e3)) {
          throw new errors.InvalidClientError("Client secret has expired");
        }
      }
      req.client = client;
      next();
    } catch (error) {
      if (error instanceof errors.OAuthError) {
        const status = error instanceof errors.ServerError ? 500 : 400;
        res.status(status).json(error.toResponseObject());
      } else {
        const serverError = new errors.ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
    }
  };
}
exports.authenticateClient = authenticateClient;
//# sourceMappingURL=clientAuth.js.map
