import { oauthProvider } from '@better-auth/oauth-provider'
import { jwt } from 'better-auth/plugins'
import type { McpConfig } from '../mcp-config'

/**
 * OAuth 2.1 authorization server for MCP clients (Claude), registered only
 * when MCP is enabled. Access tokens are JWTs (RFC 9068) signed by the `jwt`
 * plugin and audience-bound to the MCP resource; the MCP endpoint verifies
 * them in-process with `oauthProviderResourceClient(auth)` (local JWKS).
 *
 * With MCP off this returns no plugins and no extra paths or origins, so the
 * auth setup is exactly as without MCP.
 */
export function buildMcpAuthOptions(config: McpConfig) {
  if (!config.enabled) {
    return { plugins: [], disabledPaths: [], trustedOrigins: [] }
  }
  return {
    plugins: [
      jwt({
        // Only used to sign OAuth tokens: no session JWT header on getSession.
        disableSettingJwtHeader: true,
      }),
      oauthProvider({
        loginPage: '/login',
        consentPage: '/oauth/consent',
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        // Treat registrations that omit application_type and use a loopback
        // or custom-scheme redirect (Claude Code, Desktop) as native clients;
        // the default ("web") rejects loopback redirects outright.
        clientRegistrationDefaultApplicationType: 'infer',
        resources: [config.resource],
        clientRegistrationDefaultResources: [config.resource],
        scopes: ['offline_access'],
        // Every token acts for a signed-in user: no client_credentials grant.
        grantTypes: ['authorization_code', 'refresh_token'],
      }),
    ],
    // The jwt plugin's session-JWT route is not needed for OAuth tokens.
    disabledPaths: ['/token'],
    trustedOrigins: [config.baseUrl],
  }
}
