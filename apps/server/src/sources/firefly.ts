import { fetchJson } from './http';

// Minimal shapes of the Firefly III API objects we use.
export interface FireflyJournal {
  date: string;
  type: 'withdrawal' | 'deposit' | 'transfer' | string;
  amount: string;
  currency_code?: string;
  category_name?: string | null;
  tags?: string[] | null;
  description?: string | null;
  source_name?: string | null;
  destination_name?: string | null;
}

export interface FireflyTransactionGroup {
  id: string;
  attributes: { transactions: FireflyJournal[] };
}

export interface FireflyAccount {
  id: string;
  attributes: {
    name: string;
    type?: string;
    currency_code?: string;
    current_balance?: string;
    include_net_worth?: boolean;
    notes?: string | null;
  };
}

interface Page<T> {
  data: T[];
  meta?: { pagination?: { total_pages?: number } };
}

const PAGE_LIMIT = 100;
const MAX_PAGES = 1000;

export class FireflyClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    return fetchJson<T>('firefly', url.toString(), {
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.api+json' },
    });
  }

  private async all<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
    const out: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await this.get<Page<T>>(path, { ...params, page, limit: PAGE_LIMIT });
      if (Array.isArray(res.data)) out.push(...res.data);
      const total = res.meta?.pagination?.total_pages ?? 1;
      if (page >= total) break;
    }
    return out;
  }

  /** All transactions from `startDate` onwards (including scheduled/future ones). */
  fetchTransactions(startDate: string) {
    // An explicit far-future end so Firefly never applies a default period.
    const end = `${new Date().getFullYear() + 5}-12-31`;
    return this.all<FireflyTransactionGroup>('/transactions', { start: startDate, end, type: 'all' });
  }

  fetchAssetAccounts(date?: string) {
    return this.all<FireflyAccount>('/accounts', date ? { type: 'asset', date } : { type: 'asset' });
  }

  fetchLiabilityAccounts(date?: string) {
    return this.all<FireflyAccount>('/accounts', date ? { type: 'liabilities', date } : { type: 'liabilities' });
  }

  async fetchTags(): Promise<string[]> {
    const tags = await this.all<{ attributes: { tag: string } }>('/tags');
    return [...new Set(tags.map((t) => t.attributes.tag))].sort((a, b) => a.localeCompare(b));
  }

  async about(): Promise<{ version: string; apiVersion: string }> {
    const res = await this.get<{ data: { version: string; api_version: string } }>('/about');
    return { version: res.data.version, apiVersion: res.data.api_version };
  }

  transactionUrl(groupId: string) {
    return `${this.baseUrl}/transactions/show/${encodeURIComponent(groupId)}`;
  }
}
