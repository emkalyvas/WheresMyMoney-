import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import nodemailer from 'nodemailer';
import type { ReportRun, ReportsOverview, StatisticsPayload } from '@wmm/shared';
import { type DB, kvGet, kvSet } from '../db';
import type { SettingsStore } from '../settings/store';
import type { SnapshotStore } from '../sync/snapshots';
import type { SyncService } from '../sync/service';
import { renderReportPdf } from './pdf';
import { fmt, strings } from './strings';

const KV_LAST_SCHEDULED = 'reports_last_scheduled_month';

export class ReportService {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DB,
    private readonly settings: SettingsStore,
    private readonly snapshots: SnapshotStore,
    private readonly sync: SyncService,
    private readonly log: FastifyBaseLogger,
  ) {}

  emailConfigured(): boolean {
    const r = this.settings.get().reports;
    return !!r.smtp.host && r.recipients.length > 0;
  }

  async generatePdf(data?: StatisticsPayload): Promise<{ pdf: Buffer; filename: string }> {
    const payload = data ?? this.snapshots.getCurrent();
    if (!payload) throw new Error('NO_DATA');
    const s = this.settings.get();
    const pdf = await renderReportPdf(payload, {
      locale: s.general.locale,
      language: s.appearance.language,
      redactAccountNames: s.reports.redactAccountNames,
    });
    const d = new Date(payload.meta.lastUpdated);
    const filename = `WheresMyMoney_Report_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}.pdf`;
    return { pdf, filename };
  }

  private transport() {
    const { smtp } = this.settings.get().reports;
    const pass = this.settings.getSecret('smtp.pass');
    return nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && pass ? { user: smtp.user, pass } : undefined,
      connectionTimeout: 15_000,
    });
  }

  private from() {
    const { smtp } = this.settings.get().reports;
    return smtp.from || `"WheresMyMoney!" <${smtp.user || 'reports@localhost'}>`;
  }

  async sendTestEmail(): Promise<void> {
    const s = this.settings.get();
    const t = strings(s.appearance.language);
    const id = this.startRun('test', s.reports.recipients.length);
    try {
      await this.transport().sendMail({
        from: this.from(),
        to: s.reports.recipients.join(', '),
        subject: t.email.testSubject,
        text: t.email.testBody,
      });
      this.finishRun(id, 'sent');
    } catch (err) {
      this.finishRun(id, 'failed', smtpError(err));
      throw new Error(smtpError(err));
    }
  }

  /** Generates the report from fresh data and e-mails it to the configured recipients. */
  async sendReport(trigger: 'manual' | 'schedule'): Promise<void> {
    const s = this.settings.get();
    const t = strings(s.appearance.language);
    const id = this.startRun(trigger, s.reports.recipients.length);
    try {
      if (this.sync.isConfigured()) await this.sync.start('refresh').done;
      const { pdf, filename } = await this.generatePdf();
      const month = new Date().toLocaleDateString(s.general.locale, { month: 'long', year: 'numeric' });
      await this.transport().sendMail({
        from: this.from(),
        to: s.reports.recipients.join(', '),
        subject: fmt(t.email.subject, { month }),
        text: `${fmt(t.email.body, { month })}\n\n— ${t.email.footer}`,
        attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
      });
      this.finishRun(id, 'sent');
    } catch (err) {
      const message = err instanceof Error && err.message === 'NO_DATA' ? 'no_data' : smtpError(err);
      this.finishRun(id, 'failed', message);
      throw new Error(message);
    }
  }

  recordGenerated() {
    this.finishRun(this.startRun('manual', 0), 'generated');
  }

  overview(): ReportsOverview {
    const runs = (
      this.db.prepare('SELECT * FROM report_runs ORDER BY created_at DESC LIMIT 20').all() as {
        id: string;
        created_at: string;
        trigger: ReportRun['trigger'];
        status: ReportRun['status'];
        recipients: number;
        error: string | null;
      }[]
    ).map<ReportRun>((r) => ({
      id: r.id,
      createdAt: r.created_at,
      trigger: r.trigger,
      status: r.status,
      recipients: r.recipients,
      error: r.error ?? undefined,
    }));
    return { runs, nextRunAt: this.nextRunAt()?.toISOString() ?? null, emailConfigured: this.emailConfigured() };
  }

  /** Next scheduled send in local time, or null when scheduling is off. */
  nextRunAt(now = new Date()): Date | null {
    const r = this.settings.get().reports;
    if (!r.scheduleEnabled || !this.emailConfigured()) return null;
    const [h, m] = r.time.split(':').map(Number);
    const candidate = new Date(now.getFullYear(), now.getMonth(), r.dayOfMonth, h, m);
    const thisMonth = `${now.getFullYear()}-${now.getMonth()}`;
    if (candidate <= now || kvGet<string>(this.db, KV_LAST_SCHEDULED) === thisMonth) {
      return new Date(now.getFullYear(), now.getMonth() + 1, r.dayOfMonth, h, m);
    }
    return candidate;
  }

  /** Checks every minute whether the monthly report is due (robust to restarts and missed minutes). */
  start() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(now = new Date()) {
    const r = this.settings.get().reports;
    if (!r.scheduleEnabled || !this.emailConfigured()) return;
    const [h, m] = r.time.split(':').map(Number);
    const due = new Date(now.getFullYear(), now.getMonth(), r.dayOfMonth, h, m);
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    if (now < due || kvGet<string>(this.db, KV_LAST_SCHEDULED) === monthKey) return;
    kvSet(this.db, KV_LAST_SCHEDULED, monthKey);
    try {
      await this.sendReport('schedule');
      this.log.info('scheduled report sent');
    } catch (err) {
      this.log.warn({ error: (err as Error).message }, 'scheduled report failed');
    }
  }

  private startRun(trigger: ReportRun['trigger'], recipients: number): string {
    const id = crypto.randomUUID();
    this.db
      .prepare('INSERT INTO report_runs (id, created_at, trigger, status, recipients) VALUES (?, ?, ?, ?, ?)')
      .run(id, new Date().toISOString(), trigger, 'generated', recipients);
    return id;
  }

  private finishRun(id: string, status: ReportRun['status'], error?: string) {
    this.db.prepare('UPDATE report_runs SET status = ?, error = ? WHERE id = ?').run(status, error ?? null, id);
  }
}

/** SMTP errors without server names/addresses. */
function smtpError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number };
  if (e?.code === 'EAUTH') return 'smtp: authentication failed';
  if (e?.code === 'ECONNECTION' || e?.code === 'ETIMEDOUT' || e?.code === 'ESOCKET') return 'smtp: unreachable';
  if (e?.code === 'EENVELOPE') return 'smtp: recipient rejected';
  if (e?.responseCode) return `smtp: rejected (${e.responseCode})`;
  return 'smtp: failed';
}
