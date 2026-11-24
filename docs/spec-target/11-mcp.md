# MCP Server

An optional [Model Context Protocol](https://modelcontextprotocol.io) server lets Claude (claude.ai, Claude Desktop, Claude Code) work with DocProc. It is off by default and shares the same service layer (`src/services/`) as the REST API.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_ENABLED` | unset (off) | Must be exactly `true` to enable MCP |
| `MCP_PATH` | `/mcp` | Path the endpoint is served at |
| `BETTER_AUTH_URL` | | Must be the **public** origin of the server (no path; DocProc does not support sub-path hosting). It becomes the OAuth issuer and, with `MCP_PATH`, the resource identifier |

If `MCP_ENABLED=true` but `BETTER_AUTH_URL` or `MCP_PATH` is invalid (for example `BETTER_AUTH_URL` with a path, or `MCP_PATH` under `/api`), MCP stays disabled and a reason is logged.

Notes:

- Changing `MCP_PATH` or `BETTER_AUTH_URL` changes the resource identifier, so existing clients must reconnect.
- claude.ai needs a public HTTPS URL. Claude Code can use a local URL.
- Reverse proxies must preserve the `Host` header; the endpoint refuses requests whose host does not match.
- The Vite dev proxy reads `MCP_PATH` from the process environment only (not from `.env`).

The connector URL is `https://<host>/mcp` (or your `MCP_PATH`).

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST <MCP_PATH>` | Stateless MCP (streamable HTTP) endpoint |
| `/.well-known/oauth-authorization-server` | OAuth authorization server metadata |
| `/.well-known/oauth-protected-resource<MCP_PATH>` | Protected resource metadata |
| `/api/auth/oauth2/*` | better-auth OAuth provider: `register` (dynamic client registration), `authorize`, `consent`, `token` |
| `/login`, `/oauth/consent` | Sign-in and consent pages (web app) |

With MCP disabled the MCP endpoint, the discovery documents and the OAuth provider routes are not registered: `POST <MCP_PATH>` and `/api/auth/oauth2/*` return 404, and in a production build GET requests to `/.well-known/*` and `<MCP_PATH>` fall through to the web app (HTML), the same as a DocProc build without MCP. `/login` and `/oauth/consent` are web-app pages and always exist; with MCP off the consent page says MCP isn't enabled.

## Authentication

1. The client calls `POST <MCP_PATH>` without a token and gets 401 with a pointer to the protected resource metadata.
2. The client discovers the authorization server and registers itself (dynamic client registration).
3. The user signs in to DocProc and approves a consent screen naming the client. PKCE (S256) is required, and the token is bound to the resource URL.
4. The client receives a JWT access token (up to 1 hour) and a refresh token.

Only the `offline_access` scope is supported. Consent is remembered per client, so a later sign-in skips the consent screen.

### Live authorization

The token only identifies the user. On every request the server loads the user and checks their current role with better-auth, and again for each tool call. A demoted or removed user is refused on the next call even though the JWT is still unexpired. What Claude can do equals the user's role.

## Tools

| Tool | Permission | Description |
|------|------------|-------------|
| `list_document_types` | `documentType:list` | List document types |
| `get_document_type` | `documentType:list` | Get a type with its schema |
| `list_documents` | `document:list` | List documents, filter by type and status |
| `get_document` | `document:list` | Get a document with extracted data |
| `get_document_file` | `document:list` | Get the original file (images as image content, PDFs as raw files) |
| `get_job` | `document:list` | Check a processing job |
| `upload_document` | `document:create` | Upload a base64 file, optionally start extraction |
| `process_document` | `document:update` | Run extraction; waits 45 s, then returns a job id for `get_job` |
| `update_document_data` | `document:update` | Edit extracted data (validated against the schema) |
| `set_document_status` | `document:update` | Set `approved`, `rejected` or `processed` |
| `create_document_type` | `documentType:create` | Create a type (admin) |
| `update_document_type` | `documentType:update` | Update a type (admin) |

A refused call returns a tool error that names the role and the missing permission, for example ``this needs documentType:create``.

### Limits

- Uploads are limited to 5 MB decoded, but base64 through chat makes anything beyond tens or hundreds of KB impractical; use the web UI for larger files.
- `process_document` waits up to 45 seconds. If extraction is still running it returns a job id.
- PDFs are returned as raw files rather than rendered pages.

## Accepted gaps

- A password change does not disconnect an existing MCP connection.
- A user who is demoted and later restored regains their existing connection.
- A JWT stays valid for up to 1 hour, but the live check refuses it on the next call once the user lost access.
