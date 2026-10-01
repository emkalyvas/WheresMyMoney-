import type { FireflyTransactionGroup } from '../sources/firefly';

export interface Journal {
  groupId: string;
  date: Date;
  type: string;
  amount: number;
  currency: string | undefined;
  category: string;
  tags: string[];
  description: string;
  sourceName: string | null | undefined;
  destinationName: string | null | undefined;
}

export const UNCATEGORIZED = 'Uncategorized';

/** Flattens Firefly transaction groups (with splits) into individual journals. */
export function normalizeTransactions(groups: FireflyTransactionGroup[]): Journal[] {
  const journals: Journal[] = [];
  for (const g of groups) {
    for (const j of g.attributes?.transactions ?? []) {
      journals.push({
        groupId: g.id,
        date: new Date(j.date),
        type: j.type,
        amount: Number.parseFloat(j.amount ?? '0'),
        currency: j.currency_code,
        category: j.category_name || UNCATEGORIZED,
        tags: j.tags ?? [],
        description: j.description ?? '',
        sourceName: j.source_name,
        destinationName: j.destination_name,
      });
    }
  }
  return journals;
}

/** YYYY-MM in local time. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** YYYY-MM-DD in local time (the process TZ follows the configured timezone). */
export function localDateKey(date: Date): string {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sumAmounts(journals: { amount: number }[]): number {
  return journals.reduce((acc, j) => acc + j.amount, 0);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Every YYYY-MM between two dates, inclusive. */
export function monthRange(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    months.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const acc: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
  }
  return acc;
}

/** Case- and accent-insensitive comparison key (Εφορία == εφορια). */
export function foldKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

export const DAYS_IN_MONTH = 365 / 12;
