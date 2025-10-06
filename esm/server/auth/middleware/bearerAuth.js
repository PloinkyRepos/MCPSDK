import { InvalidTokenError, InsufficientScopeError, ServerError, OAuthError } from "../errors.js";
function requireBearerAuth({ verifier, requiredScopes = [], resourceMetadataUrl }) {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new InvalidTokenError("Missing Authorization header");
      }
      const [type, token] = authHeader.split(" ");
      if (type.toLowerCase() !== "bearer" || !token) {
        throw new InvalidTokenError("Invalid Authorization header format, expected 'Bearer TOKEN'");
      }
      const authInfo = await verifier.verifyAccessToken(token);
      if (requiredScopes.length > 0) {
        const hasAllScopes = requiredScopes.every((scope) => authInfo.scopes.includes(scope));
        if (!hasAllScopes) {
          throw new InsufficientScopeError("Insufficient scope");
        }
      }
      if (typeof authInfo.expiresAt !== "number" || isNaN(authInfo.expiresAt)) {
        throw new InvalidTokenError("Token has no expiration time");
      } else if (authInfo.expiresAt < Date.now() / 1e3) {
        throw new InvalidTokenError("Token has expired");
      }
      req.auth = authInfo;
      next();
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        const wwwAuthValue = resourceMetadataUrl ? `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"` : `Bearer error="${error.errorCode}", error_description="${error.message}"`;
        res.set("WWW-Authenticate", wwwAuthValue);
        res.status(401).json(error.toResponseObject());
      } else if (error instanceof InsufficientScopeError) {
        const wwwAuthValue = resourceMetadataUrl ? `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"` : `Bearer error="${error.errorCode}", error_description="${error.message}"`;
        res.set("WWW-Authenticate", wwwAuthValue);
        res.status(403).json(error.toResponseObject());
      } else if (error instanceof ServerError) {
        res.status(500).json(error.toResponseObject());
      } else if (error instanceof OAuthError) {
        res.status(400).json(error.toResponseObject());
      } else {
        const serverError = new ServerError("Internal Server Error");
        res.status(500).json(serverError.toResponseObject());
      }
    }
  };
}
export {
  requireBearerAuth
};
//# sourceMappingURL=bearerAuth.js.map
