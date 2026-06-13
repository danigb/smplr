/**
 * `fetch()` that rejects on a non-2xx response.
 *
 * Without this, a CDN 404/5xx returns an HTML body that gets fed to a JSON or
 * SFZ parser, surfacing as an obscure parser stack trace instead of a clear
 * "instrument not found" style error.
 */
export async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `smplr: failed to fetch ${url} (${res.status} ${res.statusText})`,
    );
  }
  return res;
}
