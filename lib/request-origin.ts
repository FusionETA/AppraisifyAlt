/**
 * Behind nginx, Next.js's `request.url` reports the listener address
 * (e.g. http://localhost:3005) instead of the public host. Building
 * absolute redirects from it sends browsers to localhost. Use this helper
 * as the base for `new URL(path, base)` whenever a route handler returns
 * a redirect.
 */
export function getRequestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000"
  const proto = request.headers.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}
