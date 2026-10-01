import type { GrOeSettings, TaxBreakdownRow, TaxResult } from '@wmm/shared';
import type { FireflyAccount } from '../sources/firefly';
import { type Journal, foldKey } from '../calc/util';
import type { TaxContext } from './index';

/**
 * Greek OE (Ομόρρυθμη Εταιρεία) tax estimate:
 *  - VAT is extracted from gross amounts per transaction (tag-driven rate)
 *  - Corporate income tax on net profit
 *  - Flat business tax (τέλος επιτηδεύματος)
 *  - Advance tax for next year, minus the advance prepaid last year
 *
 * The output shape is part of the public statistics API — keep it stable.
 */
export function calculateGrOe(ctx: TaxContext, cfg: GrOeSettings): TaxResult {
  const { allJournals, liabilityAccounts, currentYear, previousYear } = ctx;
  const { companyTag } = cfg;

  const split = (j: Journal) => {
    const rate = vatRateFor(j.tags, cfg);
    const net = j.amount / (1 + rate / 100);
    return { gross: j.amount, net, vat: j.amount - net };
  };

  const isCompany = (j: Journal, type: string) =>
    j.date.getFullYear() === currentYear && j.type === type && j.tags.includes(companyTag);

  let companyExpensesNet = 0;
  let companyExpensesGross = 0;
  let vatPaid = 0;
  for (const j of allJournals.filter((j) => isCompany(j, 'withdrawal'))) {
    const s = split(j);
    companyExpensesGross += s.gross;
    companyExpensesNet += s.net;
    vatPaid += s.vat;
  }

  let revenueNet = 0;
  let revenueGross = 0;
  let vatCollected = 0;
  for (const j of allJournals.filter((j) => isCompany(j, 'deposit'))) {
    const s = split(j);
    revenueGross += s.gross;
    revenueNet += s.net;
    vatCollected += s.vat;
  }

  const netTaxableProfit = Math.max(0, revenueNet - companyExpensesNet);
  const corporateIncomeTax = netTaxableProfit * cfg.incomeTaxRate;
  const businessTax = cfg.businessTax;
  const advanceTax = corporateIncomeTax * cfg.advanceTaxRate;
  const previousAdvanceTax = findPreviousAdvanceTax(liabilityAccounts, previousYear, cfg) ?? 0;

  const expectedTaxTotal = corporateIncomeTax + businessTax + advanceTax - previousAdvanceTax;
  const effectiveTaxRate = revenueNet > 0 ? (expectedTaxTotal / revenueNet) * 100 : 0;
  const vatLiability = vatCollected - vatPaid;

  let vatPaidToGovt = 0;
  if (cfg.vatPaidTags.length > 0) {
    const required = cfg.vatPaidTags.map(foldKey);
    vatPaidToGovt = allJournals
      .filter((j) => {
        if (j.date.getFullYear() !== currentYear || j.type !== 'withdrawal' || j.tags.length === 0) return false;
        const tags = j.tags.map(foldKey);
        return required.every((r) => tags.includes(r));
      })
      .reduce((acc, j) => acc + j.amount, 0);
  }

  const breakdown: TaxBreakdownRow[] = [
    {
      key: 'cit',
      label: 'Corporate Income Tax (CIT)',
      value: corporateIncomeTax,
      type: 'warning',
      info: `CIT × ${(cfg.incomeTaxRate * 100).toFixed(0)}%`,
      path: 'tax.breakdown[0].value',
    },
    {
      key: 'businessTax',
      label: 'Business Tax (Telos Epitidevmatos)',
      value: businessTax,
      type: 'warning',
      info: 'Flat annual fee',
      path: 'tax.breakdown[1].value',
    },
    {
      key: 'advanceTax',
      label: 'Advance Tax (Prokatavoli)',
      value: advanceTax,
      type: 'negative',
      info: `${(cfg.advanceTaxRate * 100).toFixed(0)}% of CIT towards next year`,
      path: 'tax.breakdown[2].value',
    },
  ];
  if (previousAdvanceTax > 0) {
    breakdown.push({
      key: 'previousAdvanceTax',
      label: 'Minus Previous Advance Tax',
      value: -previousAdvanceTax,
      type: 'positive',
      info: `Prepaid tax from ${previousYear}`,
      path: 'tax.breakdown[3].value',
    });
  }

  return {
    enabled: true,
    module: 'gr_oe',
    year: currentYear,
    description: 'Greek OE Company Tax Calculation (CIT, Advance Tax, and Flat Business Tax).',
    grossRevenue: revenueNet, // v1 naming kept for API compatibility
    companyExpenses: companyExpensesNet,
    revenue: { net: revenueNet, gross: revenueGross, vat: vatCollected },
    expenses: { net: companyExpensesNet, gross: companyExpensesGross, vat: vatPaid },
    vatLiability: {
      collected: vatCollected,
      paid: vatPaid,
      total: vatLiability,
      paidToGovt: vatPaidToGovt,
      remaining: vatLiability - vatPaidToGovt,
    },
    netTaxableProfit,
    expectedTaxTotal,
    effectiveTaxRate,
    breakdown,
  };
}

/**
 * VAT rate for a transaction: the no-VAT tag → 0; a tag starting with the VAT
 * prefix → the number at its end (e.g. "ΦΠΑ 13" → 13); otherwise the default.
 */
export function vatRateFor(tags: string[], cfg: Pick<GrOeSettings, 'noVatTag' | 'vatTagPrefix' | 'defaultVat'>) {
  if (tags.includes(cfg.noVatTag)) return 0;
  const tag = cfg.vatTagPrefix ? tags.find((t) => t.startsWith(cfg.vatTagPrefix)) : undefined;
  if (tag) {
    // v1 read the last two characters; this also accepts 1-digit rates and a trailing "%".
    const m = /(\d{1,2})\s*%?\s*$/.exec(tag);
    if (m) return Number.parseInt(m[1], 10);
  }
  return cfg.defaultVat;
}

/** true when a tag starts with the VAT prefix but carries no readable rate (e.g. "ΦΠΑ"). */
export function isUnparseableVatTag(tag: string, cfg: Pick<GrOeSettings, 'vatTagPrefix'>) {
  return !!cfg.vatTagPrefix && tag.startsWith(cfg.vatTagPrefix) && !/(\d{1,2})\s*%?\s*$/.test(tag);
}

export function advanceTaxAccountName(cfg: Pick<GrOeSettings, 'advanceTaxAccountPattern'>, year: number) {
  return cfg.advanceTaxAccountPattern.replaceAll('{year}', String(year));
}

export function findAdvanceTaxAccount(
  liabilities: FireflyAccount[],
  year: number,
  cfg: Pick<GrOeSettings, 'advanceTaxAccountPattern'>,
) {
  const name = advanceTaxAccountName(cfg, year);
  return liabilities.find((a) => a.attributes?.name === name);
}

export function parseAdvanceTaxNotes(notes: string, keyword: string): number | null {
  if (!keyword) return null;
  const folded = foldKey(notes);
  const kw = foldKey(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${kw}\\s*:\\s*([\\d.,]+)`).exec(folded);
  if (!m) return null;
  let raw = m[1];
  if (/^\d+,\d{1,2}$/.test(raw)) raw = raw.replace(',', '.');
  const n = Number.parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function findPreviousAdvanceTax(liabilities: FireflyAccount[], previousYear: number, cfg: GrOeSettings) {
  const acc = findAdvanceTaxAccount(liabilities, previousYear, cfg);
  if (!acc?.attributes?.notes) return null;
  return parseAdvanceTaxNotes(acc.attributes.notes, cfg.advanceTaxNotesKeyword);
}
