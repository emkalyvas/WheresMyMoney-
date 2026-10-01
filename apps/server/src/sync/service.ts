import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { HealthReport, KnownAccount, Settings, SyncJob, SyncKind, SyncStatus } from '@wmm/shared';
import { type DB, kvGet, kvSet } from '../db';
import { calculate, parseStartDate } from '../calc';
import { defaultKind } from '../calc/accounts';
import { localDateKey, normalizeTransactions } from '../calc/util';
import type { SettingsStore } from '../settings/store';
import { FireflyClient, type FireflyAccount, type FireflyTransactionGroup } from '../sources/firefly';
import { UpstreamError } from '../sources/http';
import { resolveEurRates } from '../sources/fx';
import { type ExternalAccount, type Trading212Credentials, fetchTrading212Assets } from '../sources/trading212';
import { runHealthChecks } from './health';
import type { SnapshotStore } from './snapshots';

const KV_KNOWN_ACCOUNTS = 'known_accounts';
const KV_HEALTH = 'health_report';
const KV_FX = 'fx_last_known';
const KV_LAST_SUCCESS = 'sync_last_success';

interface FetchedData {
  transactions: FireflyTransactionGroup[];
  assets: FireflyAccount[];
  liabilities: FireflyAccount[];
  external: ExternalAccount[];
  trading212Errors: { account: string; reason: string }[];
}

export class SyncNotConfiguredError extends Error {
  constructor() {
    super('Firefly III is not configured');
  }
}

export class SyncService {
  private current: SyncJob | null = null;
  private currentPromise: Promise<SyncJob> | null = null;
  private pending: { kind: SyncKind; overwrite: boolean } | null = null;
  private timer: NodeJS.Timeout | null = null;
  private nextRunAt: Date | null = null;
  private debounce: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DB,
    private readonly settings: SettingsStore,
    private readonly snapshots: SnapshotStore,
    private readonly log: FastifyBaseLogger,
  ) {}

  // -------------------------------------------------------------------------
  // Configuration helpers
  // -------------------------------------------------------------------------

  isConfigured(): boolean {
    return !!this.settings.get().firefly.url && !!this.settings.getSecret('firefly.token');
  }

  firefly(): FireflyClient {
    const url = this.settings.get().firefly.url;
    const token = this.settings.getSecret('firefly.token');
    if (!url || !token) throw new SyncNotConfiguredError();
    return new FireflyClient(url, token);
  }

  trading212Credentials(): Trading212Credentials[] {
    return this.settings.get().trading212.accounts.map((a) => ({
      ...a,
      apiKey: this.settings.getSecret(`trading212.${a.id}.apiKey`) ?? '',
      apiSecret: this.settings.getSecret(`trading212.${a.id}.apiSecret`) ?? '',
    }));
  }

  knownAccounts(): KnownAccount[] {
    return kvGet<KnownAccount[]>(this.db, KV_KNOWN_ACCOUNTS) ?? [];
  }

  health(): HealthReport {
    return kvGet<HealthReport>(this.db, KV_HEALTH) ?? { generatedAt: null, checks: [] };
  }

  // -------------------------------------------------------------------------
  // Jobs
  // -------------------------------------------------------------------------

  status(): SyncStatus {
    const last = this.db
      .prepare(`SELECT * FROM sync_runs WHERE state != 'running' ORDER BY started_at DESC LIMIT 1`)
      .get() as { id: string; kind: SyncKind; state: SyncJob['state']; started_at: string; finished_at: string; error: string | null } | undefined;
    return {
      current: this.current,
      last: last
        ? {
            id: last.id,
            kind: last.kind,
            state: last.state,
            startedAt: last.started_at,
            finishedAt: last.finished_at,
            error: last.error ?? undefined,
          }
        : null,
      nextRunAt: this.nextRunAt?.toISOString() ?? null,
      lastSuccessAt: kvGet<string>(this.db, KV_LAST_SUCCESS) ?? null,
      configured: this.isConfigured(),
    };
  }

  /**
   * Starts a job, or returns the one already running. A request arriving while a
   * job runs is queued (at most one) so the newest settings are always applied.
   */
  start(kind: SyncKind, opts: { overwrite?: boolean } = {}): { job: SyncJob; done: Promise<SyncJob> } {
    if (this.current && this.currentPromise) {
      if (this.current.kind !== kind || kind === 'refresh') this.pending = { kind, overwrite: !!opts.overwrite };
      return { job: this.current, done: this.currentPromise.then(() => this.waitIdle()) };
    }
    const job: SyncJob = {
      id: crypto.randomUUID(),
      kind,
      state: 'running',
      startedAt: new Date().toISOString(),
      progress: kind === 'rebuild-history' ? 0 : undefined,
    };
    this.current = job;
    this.db
      .prepare('INSERT INTO sync_runs (id, kind, state, started_at) VALUES (?, ?, ?, ?)')
      .run(job.id, kind, 'running', job.startedAt);

    const run = kind === 'refresh' ? this.refresh() : this.rebuildHistory(job, !!opts.overwrite);
    this.currentPromise = run
      .then(() => {
        job.state = 'succeeded';
        kvSet(this.db, KV_LAST_SUCCESS, new Date().toISOString());
      })
      .catch((err: unknown) => {
        job.state = 'failed';
        job.error = publicError(err);
        this.log.warn({ kind, error: job.error }, 'sync job failed');
        if (kind === 'refresh') this.recordFailureHealth(job.error);
      })
      .then(() => {
        job.finishedAt = new Date().toISOString();
        this.db
          .prepare('UPDATE sync_runs SET state = ?, finished_at = ?, error = ? WHERE id = ?')
          .run(job.state, job.finishedAt, job.error ?? null, job.id);
        this.db.prepare(`DELETE FROM sync_runs WHERE started_at < ?`).run(new Date(Date.now() - 30 * 86_400_000).toISOString());
        this.current = null;
        this.currentPromise = null;
        const next = this.pending;
        this.pending = null;
        if (next) this.start(next.kind, { overwrite: next.overwrite });
        return { ...job };
      });
    return { job, done: this.currentPromise };
  }

  /** Resolves once no job is running or queued. */
  async waitIdle(): Promise<SyncJob> {
    let last: SyncJob | null = null;
    while (this.currentPromise) last = await this.currentPromise;
    return last ?? (this.status().last as SyncJob);
  }

  /** Debounced refresh after settings changes. */
  requestRefresh(delayMs = 1500) {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.debounce = null;
      if (this.isConfigured()) this.start('refresh');
    }, delayMs);
    this.debounce.unref?.();
  }

  /** (Re)arms the periodic refresh from settings.general.syncIntervalMinutes. */
  schedule() {
    if (this.timer) clearInterval(this.timer);
    const minutes = this.settings.get().general.syncIntervalMinutes;
    const ms = minutes * 60_000;
    this.nextRunAt = new Date(Date.now() + ms);
    this.timer = setInterval(() => {
      this.nextRunAt = new Date(Date.now() + ms);
      if (this.isConfigured()) this.start('refresh');
    }, ms);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.debounce) clearTimeout(this.debounce);
    this.timer = null;
  }

  // -------------------------------------------------------------------------
  // Work
  // -------------------------------------------------------------------------

  private async fetchAll(date?: string, reuse?: FetchedData): Promise<FetchedData> {
    const settings = this.settings.get();
    const ff = this.firefly();
    const [transactions, assets, liabilities, t212] = await Promise.all([
      reuse ? reuse.transactions : ff.fetchTransactions(settings.general.startDate),
      ff.fetchAssetAccounts(date),
      ff.fetchLiabilityAccounts(date),
      reuse
        ? { assets: reuse.external, errors: [] }
        : fetchTrading212Assets(this.trading212Credentials()),
    ]);
    return {
      transactions,
      assets,
      liabilities,
      external: t212.assets,
      trading212Errors: (t212.errors ?? []).map((e) => ({
        account: e.account,
        reason: e.error instanceof UpstreamError ? e.error.reason : 'unreachable',
      })),
    };
  }

  private async rates(data: FetchedData, settings: Settings) {
    const currencies = [...data.assets, ...data.liabilities]
      .map((a) => a.attributes?.currency_code)
      .filter((c): c is string => !!c);
    const lastKnown = kvGet<Record<string, number>>(this.db, KV_FX) ?? {};
    const fx = await resolveEurRates(currencies, settings.fx, lastKnown);
    kvSet(this.db, KV_FX, { ...lastKnown, ...Object.fromEntries(fx.rates) });
    return fx;
  }

  private async refresh() {
    const settings = this.settings.get();
    const now = new Date();
    const data = await this.fetchAll();
    const fx = await this.rates(data, settings);

    const { payload, journals } = calculate({
      transactions: data.transactions,
      assetAccounts: [...data.assets, ...data.external],
      liabilityAccounts: data.liabilities,
      eurRates: fx.rates,
      now,
      settings,
    });

    const needsBackfill = !this.hasHistoryBefore(localDateKey(now));
    this.snapshots.saveCurrent(payload);
    this.snapshots.saveDaily(localDateKey(now), payload);

    const known: KnownAccount[] = [
      ...data.assets.map((a) => this.knownFromFirefly(a, 'asset', fx.rates)),
      ...data.liabilities.map((a) => this.knownFromFirefly(a, 'liability', fx.rates)),
      ...data.external.map<KnownAccount>((a) => ({
        name: a.name,
        source: 'trading212',
        type: 'asset',
        currency: a.currency,
        balance: a.balance,
        balanceEur: a.balanceEur,
        excludedInFirefly: false,
        suggestedKind: defaultKind(a),
      })),
    ];
    kvSet(this.db, KV_KNOWN_ACCOUNTS, known);

    const ff = this.firefly();
    kvSet(
      this.db,
      KV_HEALTH,
      runHealthChecks({
        settings,
        journals: journals.filter((j) => j.date >= parseStartDate(settings.general.startDate)),
        allJournalsIncludingFuture: normalizeTransactions(data.transactions),
        liabilities: data.liabilities,
        knownAccounts: known,
        now,
        trading212Errors: data.trading212Errors,
        fx: { missing: fx.missing, stale: fx.stale },
        transactionUrl: (id) => ff.transactionUrl(id),
      }),
    );

    if (needsBackfill) this.pending ??= { kind: 'rebuild-history', overwrite: false };
  }

  /**
   * Computes a snapshot for the last day of every complete month since the
   * start date. Transactions, Trading 212 and FX are fetched ONCE; only account
   * balances are fetched per month (Firefly supports balances "as of" a date).
   * Trading 212 and FX have no history API, so current values are used and the
   * snapshot is marked as approximate.
   */
  private async rebuildHistory(job: SyncJob, overwrite: boolean) {
    const settings = this.settings.get();
    const base = await this.fetchAll();
    const fx = await this.rates(base, settings);

    const start = parseStartDate(settings.general.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthEnds: Date[] = [];
    for (let d = new Date(start.getFullYear(), start.getMonth() + 1, 0); d < today; d = new Date(d.getFullYear(), d.getMonth() + 2, 0)) {
      monthEnds.push(d);
    }

    const approximations = ['fxAtCurrentRates', ...(base.external.length ? ['externalAssetsAtCurrentValue'] : [])];
    let done = 0;
    for (const monthEnd of monthEnds) {
      const date = localDateKey(monthEnd);
      if (!overwrite && this.snapshots.hasDaily(date)) {
        job.progress = ++done / monthEnds.length;
        continue;
      }
      const data = await this.fetchAll(date, base);
      const { payload } = calculate({
        transactions: data.transactions,
        assetAccounts: [...data.assets, ...data.external],
        liabilityAccounts: data.liabilities,
        eurRates: fx.rates,
        now: monthEnd,
        settings,
        approximations,
      });
      this.snapshots.saveDaily(date, payload, { overwrite });
      job.progress = ++done / monthEnds.length;
    }
  }

  private hasHistoryBefore(date: string) {
    return !!this.db.prepare('SELECT 1 FROM daily_statistics WHERE date < ? LIMIT 1').get(date);
  }

  private knownFromFirefly(a: FireflyAccount, type: 'asset' | 'liability', rates: Map<string, number>): KnownAccount {
    const currency = a.attributes.currency_code ?? 'EUR';
    const balance = Number.parseFloat(a.attributes.current_balance ?? '0');
    const rate = currency === 'EUR' ? 1 : (rates.get(currency) ?? 1);
    return {
      name: a.attributes.name,
      source: 'firefly',
      type,
      currency,
      balance,
      balanceEur: balance * rate,
      excludedInFirefly: a.attributes.include_net_worth === false,
      suggestedKind: defaultKind({ id: a.id, currency }),
    };
  }

  private recordFailureHealth(error: string) {
    const previous = this.health();
    kvSet(this.db, KV_HEALTH, {
      generatedAt: new Date().toISOString(),
      checks: [
        { id: 'firefly_sync', severity: 'error', params: { error } },
        ...previous.checks.filter((c) => c.id !== 'firefly_sync'),
      ],
    } satisfies HealthReport);
  }
}

/** Error text that is safe to show in the UI (no URLs, hosts or tokens). */
export function publicError(err: unknown): string {
  if (err instanceof UpstreamError) return err.message;
  if (err instanceof SyncNotConfiguredError) return 'firefly: not_configured';
  return 'internal_error';
}
