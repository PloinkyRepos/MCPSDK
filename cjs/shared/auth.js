"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const zod = require("zod");
const SafeUrlSchema = zod.z.string().url().superRefine((val, ctx) => {
  if (!URL.canParse(val)) {
    ctx.addIssue({
      code: zod.z.ZodIssueCode.custom,
      message: "URL must be parseable",
      fatal: true
    });
    return zod.z.NEVER;
  }
}).refine(
  (url) => {
    const u = new URL(url);
    return u.protocol !== "javascript:" && u.protocol !== "data:" && u.protocol !== "vbscript:";
  },
  { message: "URL cannot use javascript:, data:, or vbscript: scheme" }
);
const OAuthProtectedResourceMetadataSchema = zod.z.object({
  resource: zod.z.string().url(),
  authorization_servers: zod.z.array(SafeUrlSchema).optional(),
  jwks_uri: zod.z.string().url().optional(),
  scopes_supported: zod.z.array(zod.z.string()).optional(),
  bearer_methods_supported: zod.z.array(zod.z.string()).optional(),
  resource_signing_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  resource_name: zod.z.string().optional(),
  resource_documentation: zod.z.string().optional(),
  resource_policy_uri: zod.z.string().url().optional(),
  resource_tos_uri: zod.z.string().url().optional(),
  tls_client_certificate_bound_access_tokens: zod.z.boolean().optional(),
  authorization_details_types_supported: zod.z.array(zod.z.string()).optional(),
  dpop_signing_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  dpop_bound_access_tokens_required: zod.z.boolean().optional()
}).passthrough();
const OAuthMetadataSchema = zod.z.object({
  issuer: zod.z.string(),
  authorization_endpoint: SafeUrlSchema,
  token_endpoint: SafeUrlSchema,
  registration_endpoint: SafeUrlSchema.optional(),
  scopes_supported: zod.z.array(zod.z.string()).optional(),
  response_types_supported: zod.z.array(zod.z.string()),
  response_modes_supported: zod.z.array(zod.z.string()).optional(),
  grant_types_supported: zod.z.array(zod.z.string()).optional(),
  token_endpoint_auth_methods_supported: zod.z.array(zod.z.string()).optional(),
  token_endpoint_auth_signing_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  service_documentation: SafeUrlSchema.optional(),
  revocation_endpoint: SafeUrlSchema.optional(),
  revocation_endpoint_auth_methods_supported: zod.z.array(zod.z.string()).optional(),
  revocation_endpoint_auth_signing_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  introspection_endpoint: zod.z.string().optional(),
  introspection_endpoint_auth_methods_supported: zod.z.array(zod.z.string()).optional(),
  introspection_endpoint_auth_signing_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  code_challenge_methods_supported: zod.z.array(zod.z.string()).optional()
}).passthrough();
const OpenIdProviderMetadataSchema = zod.z.object({
  issuer: zod.z.string(),
  authorization_endpoint: SafeUrlSchema,
  token_endpoint: SafeUrlSchema,
  userinfo_endpoint: SafeUrlSchema.optional(),
  jwks_uri: SafeUrlSchema,
  registration_endpoint: SafeUrlSchema.optional(),
  scopes_supported: zod.z.array(zod.z.string()).optional(),
  response_types_supported: zod.z.array(zod.z.string()),
  response_modes_supported: zod.z.array(zod.z.string()).optional(),
  grant_types_supported: zod.z.array(zod.z.string()).optional(),
  acr_values_supported: zod.z.array(zod.z.string()).optional(),
  subject_types_supported: zod.z.array(zod.z.string()),
  id_token_signing_alg_values_supported: zod.z.array(zod.z.string()),
  id_token_encryption_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  id_token_encryption_enc_values_supported: zod.z.array(zod.z.string()).optional(),
  userinfo_signing_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  userinfo_encryption_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  userinfo_encryption_enc_values_supported: zod.z.array(zod.z.string()).optional(),
  request_object_signing_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  request_object_encryption_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  request_object_encryption_enc_values_supported: zod.z.array(zod.z.string()).optional(),
  token_endpoint_auth_methods_supported: zod.z.array(zod.z.string()).optional(),
  token_endpoint_auth_signing_alg_values_supported: zod.z.array(zod.z.string()).optional(),
  display_values_supported: zod.z.array(zod.z.string()).optional(),
  claim_types_supported: zod.z.array(zod.z.string()).optional(),
  claims_supported: zod.z.array(zod.z.string()).optional(),
  service_documentation: zod.z.string().optional(),
  claims_locales_supported: zod.z.array(zod.z.string()).optional(),
  ui_locales_supported: zod.z.array(zod.z.string()).optional(),
  claims_parameter_supported: zod.z.boolean().optional(),
  request_parameter_supported: zod.z.boolean().optional(),
  request_uri_parameter_supported: zod.z.boolean().optional(),
  require_request_uri_registration: zod.z.boolean().optional(),
  op_policy_uri: SafeUrlSchema.optional(),
  op_tos_uri: SafeUrlSchema.optional()
}).passthrough();
const OpenIdProviderDiscoveryMetadataSchema = OpenIdProviderMetadataSchema.merge(
  OAuthMetadataSchema.pick({
    code_challenge_methods_supported: true
  })
);
const OAuthTokensSchema = zod.z.object({
  access_token: zod.z.string(),
  id_token: zod.z.string().optional(),
  // Optional for OAuth 2.1, but necessary in OpenID Connect
  token_type: zod.z.string(),
  expires_in: zod.z.number().optional(),
  scope: zod.z.string().optional(),
  refresh_token: zod.z.string().optional()
}).strip();
const OAuthErrorResponseSchema = zod.z.object({
  error: zod.z.string(),
  error_description: zod.z.string().optional(),
  error_uri: zod.z.string().optional()
});
const OAuthClientMetadataSchema = zod.z.object({
  redirect_uris: zod.z.array(SafeUrlSchema),
  token_endpoint_auth_method: zod.z.string().optional(),
  grant_types: zod.z.array(zod.z.string()).optional(),
  response_types: zod.z.array(zod.z.string()).optional(),
  client_name: zod.z.string().optional(),
  client_uri: SafeUrlSchema.optional(),
  logo_uri: SafeUrlSchema.optional(),
  scope: zod.z.string().optional(),
  contacts: zod.z.array(zod.z.string()).optional(),
  tos_uri: SafeUrlSchema.optional(),
  policy_uri: zod.z.string().optional(),
  jwks_uri: SafeUrlSchema.optional(),
  jwks: zod.z.any().optional(),
  software_id: zod.z.string().optional(),
  software_version: zod.z.string().optional(),
  software_statement: zod.z.string().optional()
}).strip();
const OAuthClientInformationSchema = zod.z.object({
  client_id: zod.z.string(),
  client_secret: zod.z.string().optional(),
  client_id_issued_at: zod.z.number().optional(),
  client_secret_expires_at: zod.z.number().optional()
}).strip();
const OAuthClientInformationFullSchema = OAuthClientMetadataSchema.merge(OAuthClientInformationSchema);
const OAuthClientRegistrationErrorSchema = zod.z.object({
  error: zod.z.string(),
  error_description: zod.z.string().optional()
}).strip();
const OAuthTokenRevocationRequestSchema = zod.z.object({
  token: zod.z.string(),
  token_type_hint: zod.z.string().optional()
}).strip();
exports.OAuthClientInformationFullSchema = OAuthClientInformationFullSchema;
exports.OAuthClientInformationSchema = OAuthClientInformationSchema;
exports.OAuthClientMetadataSchema = OAuthClientMetadataSchema;
exports.OAuthClientRegistrationErrorSchema = OAuthClientRegistrationErrorSchema;
exports.OAuthErrorResponseSchema = OAuthErrorResponseSchema;
exports.OAuthMetadataSchema = OAuthMetadataSchema;
exports.OAuthProtectedResourceMetadataSchema = OAuthProtectedResourceMetadataSchema;
exports.OAuthTokenRevocationRequestSchema = OAuthTokenRevocationRequestSchema;
exports.OAuthTokensSchema = OAuthTokensSchema;
exports.OpenIdProviderDiscoveryMetadataSchema = OpenIdProviderDiscoveryMetadataSchema;
exports.OpenIdProviderMetadataSchema = OpenIdProviderMetadataSchema;
exports.SafeUrlSchema = SafeUrlSchema;
//# sourceMappingURL=auth.js.map
