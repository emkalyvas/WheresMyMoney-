import type { HealthCheck, HealthReport, KnownAccount, Settings } from '@wmm/shared';
import { type Journal, UNCATEGORIZED, foldKey } from '../calc/util';
import type { FireflyAccount } from '../sources/firefly';
import { advanceTaxAccountName, findAdvanceTaxAccount, isUnparseableVatTag, parseAdvanceTaxNotes } from '../tax/gr-oe';

export interface HealthInput {
  settings: Settings;
  journals: Journal[];
  allJournalsIncludingFuture: Journal[];
  liabilities: FireflyAccount[];
  knownAccounts: KnownAccount[];
  now: Date;
  brokerErrors: { account: string; reason: string }[];
  fx: { missing: string[]; stale: string[] };
  transactionUrl: (groupId: string) => string;
}

const MAX_SAMPLES = 8;

/**
 * Turns the Firefly conventions (formerly documented in FIREFLY_RULES.md)
 * into checks that run after every sync.
 */
export function runHealthChecks(i: HealthInput): HealthReport {
  const checks: HealthCheck[] = [];
  const year = i.now.getFullYear();
  const sample = (js: Journal[]) =>
    js.slice(0, MAX_SAMPLES).map((j) => ({
      date: j.date.toISOString(),
      description: j.description,
      amount: j.amount,
      url: i.transactionUrl(j.groupId),
    }));

  checks.push({ id: 'firefly_sync', severity: 'ok', params: { transactions: i.journals.length } });

  // --- Categories ----------------------------------------------------------
  const uncategorized = i.journals.filter(
    (j) => j.type !== 'transfer' && j.category === UNCATEGORIZED && j.date.getFullYear() === year,
  );
  checks.push({
    id: 'uncategorized',
    severity: uncategorized.length ? 'warning' : 'ok',
    count: uncategorized.length,
    samples: sample(uncategorized),
  });

  // --- Future-dated transactions ---------------------------------------------
  const future = i.allJournalsIncludingFuture.filter((j) => j.date > i.now);
  if (future.length) checks.push({ id: 'future_transactions', severity: 'info', count: future.length, samples: sample(future) });

  // --- Exchange rates ------------------------------------------------------
  if (i.fx.missing.length) {
    checks.push({ id: 'fx_missing', severity: 'error', count: i.fx.missing.length, params: { currencies: i.fx.missing.join(', ') } });
  }
  if (i.fx.stale.length) {
    checks.push({ id: 'fx_stale', severity: 'warning', count: i.fx.stale.length, params: { currencies: i.fx.stale.join(', ') } });
  }

  // --- Brokers (Trading 212, eToro, IBKR) ---------------------------------
  const brokerAccounts =
    i.settings.trading212.accounts.length + i.settings.etoro.accounts.length + i.settings.ibkr.accounts.length;
  if (brokerAccounts) {
    checks.push(
      i.brokerErrors.length
        ? {
            id: 'brokers',
            severity: 'error',
            count: i.brokerErrors.length,
            params: {
              accounts: i.brokerErrors.map((e) => e.account).join(', '),
              reasons: [...new Set(i.brokerErrors.map((e) => e.reason))].join(', '),
            },
          }
        : { id: 'brokers', severity: 'ok', params: { accounts: brokerAccounts } },
    );
  }

  // --- Account rules referencing accounts that no longer exist ---------------
  const known = new Set(i.knownAccounts.map((a) => a.name.toLowerCase()));
  const stale = Object.keys(i.settings.accounts.rules).filter((n) => !known.has(n.toLowerCase()));
  if (stale.length) checks.push({ id: 'unknown_account_rules', severity: 'info', count: stale.length, params: { names: stale.join(', ') } });

  // --- Tax module -----------------------------------------------------------
  if (i.settings.tax.module === 'gr_oe') {
    const cfg = i.settings.tax.grOe;
    if (!cfg.companyTag) {
      checks.push({ id: 'company_tag_missing', severity: 'error' });
    } else {
      const company = i.journals.filter(
        (j) => j.tags.includes(cfg.companyTag) && j.date.getFullYear() === year && j.type !== 'transfer',
      );
      checks.push({
        id: 'company_tag_usage',
        severity: company.length ? 'ok' : 'warning',
        count: company.length,
        params: { tag: cfg.companyTag, year },
      });

      const badVat = company.filter((j) => j.tags.some((t) => isUnparseableVatTag(t, cfg)));
      if (badVat.length) checks.push({ id: 'vat_tag_unparseable', severity: 'warning', count: badVat.length, samples: sample(badVat) });
    }

    if (cfg.vatPaidTags.length === 0) {
      checks.push({ id: 'vat_paid_tags_unset', severity: 'info' });
    } else {
      const required = cfg.vatPaidTags.map(foldKey);
      const paid = i.journals.filter(
        (j) =>
          j.type === 'withdrawal' &&
          j.date.getFullYear() === year &&
          required.every((r) => j.tags.map(foldKey).includes(r)),
      );
      checks.push({ id: 'vat_paid', severity: 'ok', count: paid.length, params: { year } });
    }

    const prevYear = year - 1;
    const account = findAdvanceTaxAccount(i.liabilities, prevYear, cfg);
    const name = advanceTaxAccountName(cfg, prevYear);
    if (!account) {
      checks.push({ id: 'advance_tax_account_missing', severity: 'info', params: { name } });
    } else if (parseAdvanceTaxNotes(account.attributes.notes ?? '', cfg.advanceTaxNotesKeyword) === null) {
      checks.push({
        id: 'advance_tax_notes_missing',
        severity: 'warning',
        params: { name, keyword: cfg.advanceTaxNotesKeyword },
      });
    } else {
      checks.push({ id: 'advance_tax_account', severity: 'ok', params: { name } });
    }
  }

  return { generatedAt: i.now.toISOString(), checks };
}
