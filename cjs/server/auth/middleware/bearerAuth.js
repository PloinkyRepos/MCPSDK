"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const errors = require("../errors.js");
function requireBearerAuth({ verifier, requiredScopes = [], resourceMetadataUrl }) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new errors.InvalidTokenError("Missing Authorization header");
      }
      const [type, token] = authHeader.split(" ");
      if (type.toLowerCase() !== "bearer" || !token) {
        throw new errors.InvalidTokenError("Invalid Authorization header format, expected 'Bearer TOKEN'");
      }
      const authInfo = await verifier.verifyAccessToken(token);
      if (requiredScopes.length > 0) {
        const hasAllScopes = requiredScopes.every((scope) => authInfo.scopes.includes(scope));
        if (!hasAllScopes) {
          throw new errors.InsufficientScopeError("Insufficient scope");
        }
      }
      if (typeof authInfo.expiresAt !== "number" || isNaN(authInfo.expiresAt)) {
        throw new errors.InvalidTokenError("Token has no expiration time");
      } else if (authInfo.expiresAt < Date.now() / 1e3) {
        throw new errors.InvalidTokenError("Token has expired");
      }
      req.auth = authInfo;
      next();
    } catch (error) {
      if (error instanceof errors.InvalidTokenError) {
        const wwwAuthValue = resourceMetadataUrl ? `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"` : `Bearer error="${error.errorCode}", error_description="${error.message}"`;
        res.set("WWW-Authenticate", wwwAuthValue);
        res.status(401).json(error.toResponseObject());
      } else if (error instanceof errors.InsufficientScopeError) {
        const wwwAuthValue = resourceMetadataUrl ? `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"` : `Bearer error="${error.errorCode}", error_description="${error.message}"`;
        res.set("WWW-Authenticate", wwwAuthValue);
        res.status(403).json(error.toResponseObject());
      } else if (error instanceof errors.ServerError) {
        res.status(500).json(error.toResponseObject());
      } else if (error instanceof errors.OAuthError) {
        res.status(400).json(error.toResponseObject());
      } else {
        const serverError = new errors.ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
    }
  };
}
exports.requireBearerAuth = requireBearerAuth;
//# sourceMappingURL=bearerAuth.js.map
