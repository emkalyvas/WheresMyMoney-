/**
 * Errors from upstream services. Messages are deliberately generic: they are
 * shown in the UI and logs, so they must never contain URLs, hostnames or tokens.
 */
export class UpstreamError extends Error {
  constructor(
    readonly service: 'firefly' | 'trading212' | 'fx' | 'smtp',
    readonly reason: 'unreachable' | 'unauthorized' | 'not_found' | 'rate_limited' | 'bad_response' | 'timeout',
    readonly status?: number,
  ) {
    super(`${service}: ${reason}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'UpstreamError';
  }
}

export async function fetchJson<T>(
  service: UpstreamError['service'],
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
  } catch (err) {
    const name = (err as Error)?.name;
    throw new UpstreamError(service, name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unreachable');
  }
  if (res.status === 401 || res.status === 403) throw new UpstreamError(service, 'unauthorized', res.status);
  if (res.status === 404) throw new UpstreamError(service, 'not_found', res.status);
  if (res.status === 429) throw new UpstreamError(service, 'rate_limited', res.status);
  if (!res.ok) throw new UpstreamError(service, 'bad_response', res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError(service, 'bad_response', res.status);
  }
}
