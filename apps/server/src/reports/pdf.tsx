import { createRequire } from 'node:module';
import {
  Document,
  Font,
  Line,
  Page,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { AccountStat, StatisticsPayload } from '@wmm/shared';
import { type Strings, fmt, strings } from './strings';

const require = createRequire(import.meta.url);
const font = (w: string) => require.resolve(`@expo-google-fonts/inter/${w}/Inter_${w}.ttf`);

// Inter covers Latin and Greek, so account/category names in Greek render correctly.
Font.register({
  family: 'Inter',
  fonts: [
    { src: font('400Regular'), fontWeight: 400 },
    { src: font('600SemiBold'), fontWeight: 600 },
    { src: font('700Bold'), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const C = {
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e2e8f0',
  soft: '#f8fafc',
  accent: '#4f46e5',
  income: '#0d9488',
  expense: '#e11d48',
  positive: '#047857',
  negative: '#be123c',
};

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: C.ink, padding: 40, paddingBottom: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  brand: { fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: 0.5 },
  title: { fontSize: 20, fontWeight: 700, marginTop: 2 },
  meta: { fontSize: 8, color: C.muted, textAlign: 'right' },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  tile: { width: '25%', padding: 4 },
  tileInner: { backgroundColor: C.soft, borderRadius: 4, padding: 8, minHeight: 46 },
  tileLabel: { fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  tileValue: { fontSize: 12, fontWeight: 700, marginTop: 4 },
  hero: { backgroundColor: C.ink, color: 'white', borderRadius: 6, padding: 14, marginBottom: 8 },
  heroLabel: { fontSize: 8, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroValue: { fontSize: 24, fontWeight: 700, marginTop: 4 },
  heroSub: { fontSize: 8, color: '#cbd5e1', marginTop: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 4 },
  th: { fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 },
  cellName: { flex: 3 },
  cellNum: { flex: 1.4, textAlign: 'right' },
  bold: { fontWeight: 700 },
  note: { fontSize: 7, color: C.muted, marginTop: 6 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.muted },
  legend: { flexDirection: 'row', marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, fontSize: 7, color: C.muted },
  swatch: { width: 7, height: 7, borderRadius: 1, marginRight: 4 },
});

export interface ReportOptions {
  locale: string;
  language?: string;
  redactAccountNames: boolean;
  generatedAt?: Date;
}

export async function renderReportPdf(data: StatisticsPayload, opts: ReportOptions): Promise<Buffer> {
  return renderToBuffer(<ReportDocument data={data} opts={opts} />);
}

function ReportDocument({ data, opts }: { data: StatisticsPayload; opts: ReportOptions }) {
  const t = strings(opts.language);
  const eur = new Intl.NumberFormat(opts.locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eur2 = new Intl.NumberFormat(opts.locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
  const date = (d: Date) => d.toLocaleDateString(opts.locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const asOf = new Date(data.meta.lastUpdated);
  const monthTitle = asOf.toLocaleDateString(opts.locale, { year: 'numeric', month: 'long' });
  const nameOf = (a: AccountStat, i: number) => (opts.redactAccountNames ? fmt(t.redactedAccount, { n: i + 1 }) : a.name);

  const { summary, assets, runway, tax } = data;
  const months = data.monthlyData.slice(-12);
  const accounts = [...assets.accounts].sort((a, b) => b.balanceEur - a.balanceEur);

  return (
    <Document title={`${t.appName} — ${t.reportTitle} — ${monthTitle}`} author={t.appName} creator={t.appName} producer={t.appName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>{t.appName.toUpperCase()}</Text>
            <Text style={s.title}>
              {t.reportTitle} — {monthTitle}
            </Text>
          </View>
          <View>
            <Text style={s.meta}>{fmt(t.generatedOn, { date: date(opts.generatedAt ?? new Date()) })}</Text>
            <Text style={s.meta}>{fmt(t.dataSince, { date: date(new Date(data.meta.dataStartDate)) })}</Text>
          </View>
        </View>

        <View style={s.hero}>
          <Text style={s.heroLabel}>{t.kpi.netWorth}</Text>
          <Text style={s.heroValue}>{eur.format(assets.netWorthEur)}</Text>
          <Text style={s.heroSub}>
            {t.kpi.assets} {eur.format(assets.totalEur)} · {t.kpi.liabilities} {eur.format(assets.totalLiabilitiesEur)}
          </Text>
        </View>

        <View style={s.grid}>
          <Tile label={t.kpi.cash} value={eur.format(runway.totalCashEur)} />
          <Tile label={t.kpi.invested} value={eur.format(assets.totalInvestedEur)} />
          <Tile label={t.kpi.savingsRate} value={`${summary.savingsRate.toFixed(1)}%`} />
          <Tile
            label={t.kpi.runway}
            value={runway.months == null ? '—' : fmt(t.kpi.runwayValue, { months: runway.months.toFixed(1) })}
          />
          <Tile label={t.kpi.income} value={eur.format(summary.meanMonthlyIncome)} color={C.positive} />
          <Tile label={t.kpi.expenses} value={eur.format(summary.meanMonthlyExpenses)} color={C.negative} />
          <Tile
            label={t.kpi.surplus}
            value={eur.format(summary.meanMonthlySurplus)}
            color={summary.meanMonthlySurplus >= 0 ? C.positive : C.negative}
          />
          <Tile label={t.kpi.surplus90} value={eur.format(summary.rolling90DaySurplus)} />
        </View>

        <Text style={s.h2}>{t.sections.monthly}</Text>
        <MonthlyBars months={months} locale={opts.locale} />
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: C.income }]} />
            <Text>{t.yoy.income}</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: C.expense }]} />
            <Text>{t.yoy.expenses}</Text>
          </View>
        </View>

        <Text style={s.h2}>{t.sections.categories}</Text>
        <View style={s.row}>
          <Text style={[s.th, s.cellName]}>{t.table.category}</Text>
          <Text style={[s.th, s.cellNum]}>{t.table.monthly}</Text>
          <Text style={[s.th, s.cellNum]}>{t.table.last90}</Text>
          <Text style={[s.th, s.cellNum]}>{t.table.total}</Text>
        </View>
        {data.categories.expenses.slice(0, 12).map((c) => {
          const r90 = data.categories.expenses90d.find((x) => x.name === c.name);
          return (
            <View key={c.name} style={s.row} wrap={false}>
              <Text style={s.cellName}>{c.name}</Text>
              <Text style={s.cellNum}>{eur.format(c.monthlyMean)}</Text>
              <Text style={s.cellNum}>{r90 ? eur.format(r90.monthlyMean) : '—'}</Text>
              <Text style={s.cellNum}>{eur.format(c.total)}</Text>
            </View>
          );
        })}

        {data.meta.approximations?.length ? <Text style={s.note}>{t.approximate}</Text> : null}
        <Footer t={t} />
      </Page>

      <Page size="A4" style={s.page}>
        {tax.enabled && (
          <View wrap={false}>
            <Text style={[s.h2, { marginTop: 0 }]}>{fmt(t.sections.tax, { year: tax.year ?? data.meta.currentYear })}</Text>
            <Rows
              rows={[
                [t.tax.revenueNet, eur2.format(tax.revenue?.net ?? tax.grossRevenue)],
                [t.tax.expensesNet, eur2.format(-(tax.expenses?.net ?? tax.companyExpenses))],
                [t.tax.profit, eur2.format(tax.netTaxableProfit), true],
                ...(tax.breakdown ?? []).map(
                  (b) => [t.tax[(b.key ?? '') as keyof Strings['tax']] ?? b.label, eur2.format(b.value)] as [string, string],
                ),
                [t.tax.expected, eur2.format(tax.expectedTaxTotal), true],
                [t.tax.effectiveRate, `${tax.effectiveTaxRate.toFixed(1)}%`],
              ]}
            />
            {tax.vatLiability && (
              <>
                <Text style={s.h2}>{t.sections.vat}</Text>
                <Rows
                  rows={[
                    [t.tax.vatCollected, eur2.format(tax.vatLiability.collected)],
                    [t.tax.vatDeductible, eur2.format(-tax.vatLiability.paid)],
                    [t.tax.vatPaid, eur2.format(-tax.vatLiability.paidToGovt)],
                    [t.tax.vatRemaining, eur2.format(tax.vatLiability.remaining), true],
                  ]}
                />
              </>
            )}
          </View>
        )}

        <View wrap={false}>
          <Text style={[s.h2, tax.enabled ? {} : { marginTop: 0 }]}>{t.sections.yoy}</Text>
          <View style={s.row}>
            <Text style={[s.th, s.cellName]}>{t.table.metric}</Text>
            <Text style={[s.th, s.cellNum]}>{fmt(t.table.previousYear, { year: data.yearOverYear.previousYear })}</Text>
            <Text style={[s.th, s.cellNum]}>{fmt(t.table.projected, { year: data.yearOverYear.currentYear })}</Text>
            <Text style={[s.th, s.cellNum]}>{t.table.change}</Text>
          </View>
          {(
            [
              [t.yoy.income, data.yearOverYear.incomePreviousYear, data.yearOverYear.projectedIncomeThisYear, data.yearOverYear.incomeGrowthPercent],
              [t.yoy.expenses, data.yearOverYear.expensesPreviousYear, data.yearOverYear.projectedExpensesThisYear, data.yearOverYear.expensesGrowthPercent],
              [t.yoy.surplus, data.surplus.previousYear, data.surplus.projectedThisYear, data.surplus.growthPercent],
            ] as const
          ).map(([label, prev, cur, change]) => (
            <View key={label} style={s.row}>
              <Text style={s.cellName}>{label}</Text>
              <Text style={s.cellNum}>{eur.format(prev)}</Text>
              <Text style={s.cellNum}>{eur.format(cur)}</Text>
              <Text style={s.cellNum}>{pct(change)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h2}>{t.sections.accounts}</Text>
        <View style={s.row}>
          <Text style={[s.th, s.cellName]}>{t.table.account}</Text>
          <Text style={[s.th, s.cellNum]}>{t.table.kind}</Text>
          <Text style={[s.th, s.cellNum]}>{t.table.share}</Text>
          <Text style={[s.th, s.cellNum]}>{t.table.balance}</Text>
        </View>
        {accounts.map((a, i) => (
          <View key={a.id} style={s.row} wrap={false}>
            <Text style={s.cellName}>{nameOf(a, i)}</Text>
            <Text style={s.cellNum}>{a.kind ? t.kinds[a.kind] : ''}</Text>
            <Text style={s.cellNum}>{(a.allocationPct ?? 0).toFixed(1)}%</Text>
            <Text style={s.cellNum}>{eur2.format(a.balanceEur)}</Text>
          </View>
        ))}

        {assets.liabilities.length > 0 && (
          <View wrap={false}>
            <Text style={s.h2}>{t.sections.liabilities}</Text>
            {assets.liabilities.map((a, i) => (
              <View key={a.id} style={s.row}>
                <Text style={s.cellName}>{nameOf(a, accounts.length + i)}</Text>
                <Text style={s.cellNum}>{eur2.format(-Math.abs(a.balanceEur))}</Text>
              </View>
            ))}
          </View>
        )}

        <View wrap={false}>
          <Text style={s.h2}>{t.sections.planning}</Text>
          <Rows
            rows={[
              [t.planning.goal, eur.format(data.projections.targetGoal)],
              [t.planning.goalYear, String(data.projections.milestones.targetYearConfiguredAmount ?? t.planning.never)],
              [t.planning.goalYearSurplus, String(data.projections.milestones.targetYearFullSurplus ?? t.planning.never)],
              [t.planning.fireTarget, data.projections.retirementTarget == null ? '—' : eur.format(data.projections.retirementTarget)],
              [t.planning.safeWithdrawal, eur.format(data.projections.safeMonthlyWithdrawal)],
            ]}
          />
        </View>
        <Footer t={t} />
      </Page>
    </Document>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.tile}>
      <View style={s.tileInner}>
        <Text style={s.tileLabel}>{label}</Text>
        <Text style={[s.tileValue, color ? { color } : {}]}>{value}</Text>
      </View>
    </View>
  );
}

function Rows({ rows }: { rows: (readonly [string, string] | readonly [string, string, boolean])[] }) {
  return (
    <View>
      {rows.map(([label, value, bold]) => (
        <View key={label} style={s.row}>
          <Text style={[s.cellName, bold ? s.bold : {}]}>{label}</Text>
          <Text style={[s.cellNum, bold ? s.bold : {}]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ t }: { t: Strings }) {
  return (
    <View style={s.footer} fixed>
      <Text>{t.appName}</Text>
      <Text render={({ pageNumber, totalPages }) => fmt(t.page, { page: pageNumber, total: totalPages })} />
    </View>
  );
}

function MonthlyBars({ months, locale }: { months: StatisticsPayload['monthlyData']; locale: string }) {
  const W = 515;
  const H = 120;
  const pad = 14;
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expenses]));
  const slot = (W - 8) / Math.max(1, months.length);
  const bar = Math.min(14, slot / 3);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  return (
    <View>
      <Svg width={W} height={H}>
        <Line x1={0} y1={H - pad} x2={W} y2={H - pad} stroke={C.line} strokeWidth={0.8} />
        {months.map((m, i) => {
          const x = 4 + i * slot + slot / 2;
          return (
            <Rect key={`i${m.month}`} x={x - bar - 1} y={y(m.income)} width={bar} height={H - pad - y(m.income)} fill={C.income} />
          );
        })}
        {months.map((m, i) => {
          const x = 4 + i * slot + slot / 2;
          return (
            <Rect key={`e${m.month}`} x={x + 1} y={y(m.expenses)} width={bar} height={H - pad - y(m.expenses)} fill={C.expense} />
          );
        })}
      </Svg>
      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        {months.map((m) => {
          const [yy, mm] = m.month.split('-').map(Number);
          return (
            <Text key={m.month} style={{ width: slot, textAlign: 'center', fontSize: 6.5, color: C.muted }}>
              {new Date(yy, mm - 1, 1).toLocaleDateString(locale, { month: 'short' })}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
