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
| `GET`/`POST /api/mcp/uploads/<token>` | Upload-link API used by the upload page (session auth) |
| `/login`, `/oauth/consent`, `/upload/<token>` | Sign-in, consent and upload-link pages (web app) |

With MCP disabled the MCP endpoint, the discovery documents, the OAuth provider routes and the upload-link API are not registered: `POST <MCP_PATH>`, `/api/auth/oauth2/*` and `/api/mcp/uploads/*` return 404, and in a production build GET requests to `/.well-known/*` and `<MCP_PATH>` fall through to the web app (HTML), the same as a DocProc build without MCP. `/login`, `/oauth/consent` and `/upload/<token>` are web-app pages and always exist; with MCP off the consent and upload pages say MCP isn't enabled.

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
| `create_upload_link` | `document:create` | Create a one-time browser upload link (see below) |
| `get_upload` | `document:create` | Check an upload link: `pending`, `completed` or `expired` |
| `upload_document` | `document:create` | Upload a tiny base64 file, optionally start extraction |
| `process_document` | `document:update` | Run extraction; waits 45 s, then returns a job id for `get_job` |
| `update_document_data` | `document:update` | Edit extracted data (validated against the schema) |
| `set_document_status` | `document:update` | Set `approved`, `rejected` or `processed` |
| `create_document_type` | `documentType:create` | Create a type (admin) |
| `update_document_type` | `documentType:update` | Update a type (admin) |

A refused call returns a tool error that names the role and the missing permission, for example ``this needs documentType:create``.

### Upload links

Claude can't send a file attached in chat as base64, and base64 through a tool call is impractical beyond a few KB. To get a real file into DocProc:

1. Claude calls `create_upload_link {documentType, process?}` and gets `{uploadId, uploadUrl, expiresAt}`. The URL is `<BETTER_AUTH_URL>/upload/<token>`.
2. The user opens the URL, signs in to DocProc if needed (the login page returns to the upload page), and drops or chooses one file.
3. The page says "Uploaded <filename>. You can go back to Claude."
4. Claude calls `get_upload {uploadId}`: `pending` (with a message to ask the user to finish), `completed` (with `documentId`, plus `jobId` when `process` was requested) or `expired`.

Rules:

- The link works only for the DocProc account that created it; anyone else signed in sees "This upload link was created for a different DocProc account." The account must still be active (not banned, role not `none`), and `document:create` is re-checked when the file is uploaded.
- One file, single use, valid for 15 minutes. If the upload itself fails (for example an unsupported file type) the link stays usable.
- Only a SHA-256 hash of the token is stored (table `mcp_upload_link`). `get_upload` only sees the caller's own links.
- The token is part of the URL, so it appears in access logs (reverse proxy, server request log) and browser history. That is accepted: it is only usable by the signed-in owner, once, within 15 minutes.
- `get_upload` keeps reporting `completed` (with the `documentId`) even if the document is deleted afterwards; `get_document` then says it was not found.
- The upload goes through the same service as the web UI, so webhooks, WebSocket events and auto-processing behave the same, with the same accepted file types (PDF, JPEG, PNG, GIF, WebP, TIFF) and the same size limit as the REST upload route (`POST /api/document-types/<type>/upload`): no DocProc-specific cap, only the server's request body limit (Bun's default, 128 MB). This is larger than `upload_document`'s 5 MB.

### Limits

- `upload_document` is limited to 5 MB decoded, but base64 through chat makes anything beyond a few KB impractical; use `create_upload_link` instead.
- `process_document` waits up to 45 seconds. If extraction is still running it returns a job id.
- PDFs are returned as raw files rather than rendered pages.

## Accepted gaps

- A password change does not disconnect an existing MCP connection.
- A user who is demoted and later restored regains their existing connection.
- A JWT stays valid for up to 1 hour, but the live check refuses it on the next call once the user lost access.
