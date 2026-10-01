export type UpstreamService = 'firefly' | 'trading212' | 'etoro' | 'ibkr' | 'fx' | 'smtp';
export type UpstreamReason =
  | 'unreachable'
  | 'unauthorized'
  | 'not_found'
  | 'rate_limited'
  | 'bad_response'
  | 'timeout'
  /** the provider is still preparing the data (e.g. an IBKR Flex statement); retried next sync */
  | 'not_ready'
  /** the provider rejected the configuration (e.g. an invalid Flex Query ID) */
  | 'invalid_config';

/**
 * Errors from upstream services. Messages are deliberately generic: they are
 * shown in the UI and logs, so they must never contain URLs, hostnames or tokens.
 */
export class UpstreamError extends Error {
  constructor(
    readonly service: UpstreamService,
    readonly reason: UpstreamReason,
    readonly status?: number,
  ) {
    super(`${service}: ${reason}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'UpstreamError';
  }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

async function request(service: UpstreamService, url: string, init: RequestOptions): Promise<Response> {
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
  return res;
}

export async function fetchJson<T>(service: UpstreamService, url: string, init: RequestOptions = {}): Promise<T> {
  const res = await request(service, url, init);
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError(service, 'bad_response', res.status);
  }
}

export async function fetchText(service: UpstreamService, url: string, init: RequestOptions = {}): Promise<string> {
  const res = await request(service, url, init);
  return res.text();
}
