class OAuthError extends Error {
  constructor(message, errorUri) {
    super(message);
    this.errorUri = errorUri;
    this.name = this.constructor.name;
  }
  /**
   * Converts the error to a standard OAuth error response object
   */
  toResponseObject() {
    const response = {
      error: this.errorCode,
      error_description: this.message
    };
    if (this.errorUri) {
      response.error_uri = this.errorUri;
    }
    return response;
  }
  get errorCode() {
    return this.constructor.errorCode;
  }
}
class InvalidRequestError extends OAuthError {
  static {
    this.errorCode = "invalid_request";
  }
}
class InvalidClientError extends OAuthError {
  static {
    this.errorCode = "invalid_client";
  }
}
class InvalidGrantError extends OAuthError {
  static {
    this.errorCode = "invalid_grant";
  }
}
class UnauthorizedClientError extends OAuthError {
  static {
    this.errorCode = "unauthorized_client";
  }
}
class UnsupportedGrantTypeError extends OAuthError {
  static {
    this.errorCode = "unsupported_grant_type";
  }
}
class InvalidScopeError extends OAuthError {
  static {
    this.errorCode = "invalid_scope";
  }
}
class AccessDeniedError extends OAuthError {
  static {
    this.errorCode = "access_denied";
  }
}
class ServerError extends OAuthError {
  static {
    this.errorCode = "server_error";
  }
}
class TemporarilyUnavailableError extends OAuthError {
  static {
    this.errorCode = "temporarily_unavailable";
  }
}
class UnsupportedResponseTypeError extends OAuthError {
  static {
    this.errorCode = "unsupported_response_type";
  }
}
class UnsupportedTokenTypeError extends OAuthError {
  static {
    this.errorCode = "unsupported_token_type";
  }
}
class InvalidTokenError extends OAuthError {
  static {
    this.errorCode = "invalid_token";
  }
}
class MethodNotAllowedError extends OAuthError {
  static {
    this.errorCode = "method_not_allowed";
  }
}
class TooManyRequestsError extends OAuthError {
  static {
    this.errorCode = "too_many_requests";
  }
}
class InvalidClientMetadataError extends OAuthError {
  static {
    this.errorCode = "invalid_client_metadata";
  }
}
class InsufficientScopeError extends OAuthError {
  static {
    this.errorCode = "insufficient_scope";
  }
}
class CustomOAuthError extends OAuthError {
  constructor(customErrorCode, message, errorUri) {
    super(message, errorUri);
    this.customErrorCode = customErrorCode;
  }
  get errorCode() {
    return this.customErrorCode;
  }
}
const OAUTH_ERRORS = {
  [InvalidRequestError.errorCode]: InvalidRequestError,
  [InvalidClientError.errorCode]: InvalidClientError,
  [InvalidGrantError.errorCode]: InvalidGrantError,
  [UnauthorizedClientError.errorCode]: UnauthorizedClientError,
  [UnsupportedGrantTypeError.errorCode]: UnsupportedGrantTypeError,
  [InvalidScopeError.errorCode]: InvalidScopeError,
  [AccessDeniedError.errorCode]: AccessDeniedError,
  [ServerError.errorCode]: ServerError,
  [TemporarilyUnavailableError.errorCode]: TemporarilyUnavailableError,
  [UnsupportedResponseTypeError.errorCode]: UnsupportedResponseTypeError,
  [UnsupportedTokenTypeError.errorCode]: UnsupportedTokenTypeError,
  [InvalidTokenError.errorCode]: InvalidTokenError,
  [MethodNotAllowedError.errorCode]: MethodNotAllowedError,
  [TooManyRequestsError.errorCode]: TooManyRequestsError,
  [InvalidClientMetadataError.errorCode]: InvalidClientMetadataError,
  [InsufficientScopeError.errorCode]: InsufficientScopeError
};
export {
  AccessDeniedError,
  CustomOAuthError,
  InsufficientScopeError,
  InvalidClientError,
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidScopeError,
  InvalidTokenError,
  MethodNotAllowedError,
  OAUTH_ERRORS,
  OAuthError,
  ServerError,
  TemporarilyUnavailableError,
  TooManyRequestsError,
  UnauthorizedClientError,
  UnsupportedGrantTypeError,
  UnsupportedResponseTypeError,
  UnsupportedTokenTypeError
};
//# sourceMappingURL=errors.js.map
