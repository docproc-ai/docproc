/** Paths the login page may continue to via `?next=`: upload-link pages only. */
const ALLOWED_NEXT = /^\/upload\/[A-Za-z0-9_-]+$/

/**
 * The validated post-login destination from a `next` query value, or null.
 * Anything but a same-origin upload page is ignored (no open redirect).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  return next && ALLOWED_NEXT.test(next) ? next : null
}
