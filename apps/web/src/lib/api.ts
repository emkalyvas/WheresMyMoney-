/**
 * Thin fetch wrapper. Authentication uses the httpOnly session cookie, so no
 * token is ever handled by JavaScript. Mutations carry the CSRF header the
 * server requires for cookie-authenticated requests.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-Requested-With'] = 'wmm';
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get('content-type')?.includes('json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? res.statusText, data?.code, data?.issues);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  delete: <T>(url: string) => request<T>('DELETE', url),
};

/** Downloads a binary response (e.g. the PDF report) as a file. */
export async function download(url: string, fallbackName: string) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) {
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    throw new ApiError(res.status, data?.error ?? res.statusText, data?.code);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
