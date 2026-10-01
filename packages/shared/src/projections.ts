import type { StatisticsPayload } from './statistics';

export interface ProjectionInputs {
  currentInvested: number;
  currentCash: number;
  meanMonthlySurplus: number;
  annualExpenses: number;
  safeWithdrawalRate: number;
  investmentGrowthRate: number;
  monthlyInvestmentAmount: number;
  targetAssetGoal: number;
  horizonYears: number;
  startYear: number;
}

/**
 * Compound-growth projection of invested assets under two scenarios:
 * investing the full average surplus, or a fixed monthly amount. Cash is
 * carried forward unchanged. Pure, so the UI can run what-if variants.
 */
export function project(i: ProjectionInputs): StatisticsPayload['projections'] {
  const retirementTarget = i.annualExpenses > 0 ? i.annualExpenses / i.safeWithdrawalRate : null;
  const safeAnnualWithdrawal = i.currentInvested * i.safeWithdrawalRate;

  const data: StatisticsPayload['projections']['data'] = [];
  let full = i.currentInvested;
  let configured = i.currentInvested;
  const annualSurplus = i.meanMonthlySurplus > 0 ? i.meanMonthlySurplus * 12 : 0;
  const configuredAnnual = i.monthlyInvestmentAmount * 12;

  const milestones = {
    retirementYearFullSurplus: null as number | null,
    retirementYearConfiguredAmount: null as number | null,
    targetYearFullSurplus: null as number | null,
    targetYearConfiguredAmount: null as number | null,
  };

  for (let y = 0; y <= i.horizonYears; y++) {
    const year = i.startYear + y;
    const fullTotal = full + i.currentCash;
    const configuredTotal = configured + i.currentCash;
    data.push({ year, fullSurplusAssets: fullTotal, configuredAmountAssets: configuredTotal });

    if (retirementTarget && fullTotal >= retirementTarget) milestones.retirementYearFullSurplus ??= year;
    if (fullTotal >= i.targetAssetGoal) milestones.targetYearFullSurplus ??= year;
    if (retirementTarget && configuredTotal >= retirementTarget) milestones.retirementYearConfiguredAmount ??= year;
    if (configuredTotal >= i.targetAssetGoal) milestones.targetYearConfiguredAmount ??= year;

    full = full * (1 + i.investmentGrowthRate) + annualSurplus;
    configured = configured * (1 + i.investmentGrowthRate) + configuredAnnual;
  }

  return {
    data,
    targetGoal: i.targetAssetGoal,
    retirementTarget,
    safeAnnualWithdrawal,
    safeMonthlyWithdrawal: safeAnnualWithdrawal / 12,
    investmentGrowthRate: i.investmentGrowthRate,
    monthlyInvestmentAmount: i.monthlyInvestmentAmount,
    inputs: {
      currentInvested: i.currentInvested,
      currentCash: i.currentCash,
      meanMonthlySurplus: i.meanMonthlySurplus,
      annualExpenses: i.annualExpenses,
      safeWithdrawalRate: i.safeWithdrawalRate,
      horizonYears: i.horizonYears,
      startYear: i.startYear,
    },
    milestones,
  };
}
