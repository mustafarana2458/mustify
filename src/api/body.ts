/**
 * A 2xx response is a success, whatever its body. Player commands and library writes may
 * return 204/empty, or 200 with a plain-text snapshot id (not JSON). So: read as text, parse
 * only non-empty JSON, otherwise return null. A malformed body on a 2xx is logged, never thrown,
 * because the action itself succeeded and must not show an error.
 * Callers that read data (GETs) all handle null.
 */
export async function parseSuccessBody<T>(res: Response, path: string): Promise<T> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    return null as T;
  }
  if (!text.trim()) return null as T;
  const type = res.headers.get('Content-Type') ?? '';
  if (!/\bjson\b/i.test(type)) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.warn(`[api] ${path}: 2xx response with a body that isn't valid JSON; treating as empty.`);
    return null as T;
  }
}
