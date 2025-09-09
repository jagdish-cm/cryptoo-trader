/**
 * Business calculation utilities for trading metrics and performance
 */

/**
 * Calculates percentage change between two values
 */
export const calculatePercentageChange = (
  oldValue: number,
  newValue: number
): number => {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
};

/**
 * Calculates profit/loss for a trade
 */
export const calculatePnL = (
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  direction: "LONG" | "SHORT"
): number => {
  const priceDiff =
    direction === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return priceDiff * quantity;
};

/**
 * Calculates unrealized P&L for an open position
 */
export const calculateUnrealizedPnL = (
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  direction: "LONG" | "SHORT"
): number => {
  return calculatePnL(entryPrice, currentPrice, quantity, direction);
};

/**
 * Calculates position size based on risk percentage
 */
export const calculatePositionSize = (
  accountBalance: number,
  riskPercentage: number,
  entryPrice: number,
  stopLossPrice: number
): number => {
  const riskAmount = accountBalance * (riskPercentage / 100);
  const priceRisk = Math.abs(entryPrice - stopLossPrice);

  if (priceRisk === 0) return 0;

  return riskAmount / priceRisk;
};

/**
 * Calculates stop loss price based on percentage
 */
export const calculateStopLossPrice = (
  entryPrice: number,
  stopLossPercentage: number,
  direction: "LONG" | "SHORT"
): number => {
  const multiplier =
    direction === "LONG"
      ? 1 - stopLossPercentage / 100
      : 1 + stopLossPercentage / 100;
  return entryPrice * multiplier;
};

/**
 * Calculates take profit price based on percentage
 */
export const calculateTakeProfitPrice = (
  entryPrice: number,
  takeProfitPercentage: number,
  direction: "LONG" | "SHORT"
): number => {
  const multiplier =
    direction === "LONG"
      ? 1 + takeProfitPercentage / 100
      : 1 - takeProfitPercentage / 100;
  return entryPrice * multiplier;
};

/**
 * Calculates win rate from trades
 */
export const calculateWinRate = (
  winningTrades: number,
  totalTrades: number
): number => {
  if (totalTrades === 0) return 0;
  return (winningTrades / totalTrades) * 100;
};

/**
 * Calculates average trade return
 */
export const calculateAverageTradeReturn = (
  trades: Array<{ realizedPnL: number }>
): number => {
  if (trades.length === 0) return 0;
  const totalPnL = trades.reduce((sum, trade) => sum + trade.realizedPnL, 0);
  return totalPnL / trades.length;
};

/**
 * Calculates maximum drawdown from equity curve
 */
export const calculateMaxDrawdown = (equityCurve: number[]): number => {
  if (equityCurve.length === 0) return 0;

  let maxDrawdown = 0;
  let peak = equityCurve[0];

  for (const value of equityCurve) {
    if (value > peak) {
      peak = value;
    }

    const drawdown = ((peak - value) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
};

/**
 * Calculates Sharpe ratio
 */
export const calculateSharpeRatio = (
  returns: number[],
  riskFreeRate: number = 0.02
): number => {
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance =
    returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
    returns.length;
  const standardDeviation = Math.sqrt(variance);

  if (standardDeviation === 0) return 0;

  return (avgReturn - riskFreeRate) / standardDeviation;
};

/**
 * Calculates portfolio volatility
 */
export const calculateVolatility = (returns: number[]): number => {
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance =
    returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
    returns.length;

  return Math.sqrt(variance) * 100; // Convert to percentage
};

/**
 * Calculates compound annual growth rate (CAGR)
 */
export const calculateCAGR = (
  initialValue: number,
  finalValue: number,
  years: number
): number => {
  if (initialValue === 0 || years === 0) return 0;
  return (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
};

/**
 * Calculates risk-reward ratio
 */
export const calculateRiskRewardRatio = (
  entryPrice: number,
  stopLossPrice: number,
  takeProfitPrice: number,
  direction: "LONG" | "SHORT"
): number => {
  const risk = Math.abs(entryPrice - stopLossPrice);
  const reward = Math.abs(takeProfitPrice - entryPrice);

  if (risk === 0) return 0;

  return reward / risk;
};

/**
 * Calculates portfolio beta (correlation with market)
 */
export const calculateBeta = (
  portfolioReturns: number[],
  marketReturns: number[]
): number => {
  if (
    portfolioReturns.length !== marketReturns.length ||
    portfolioReturns.length === 0
  ) {
    return 0;
  }

  const portfolioMean =
    portfolioReturns.reduce((sum, ret) => sum + ret, 0) /
    portfolioReturns.length;
  const marketMean =
    marketReturns.reduce((sum, ret) => sum + ret, 0) / marketReturns.length;

  let covariance = 0;
  let marketVariance = 0;

  for (let i = 0; i < portfolioReturns.length; i++) {
    const portfolioDiff = portfolioReturns[i] - portfolioMean;
    const marketDiff = marketReturns[i] - marketMean;

    covariance += portfolioDiff * marketDiff;
    marketVariance += marketDiff * marketDiff;
  }

  if (marketVariance === 0) return 0;

  return covariance / marketVariance;
};

/**
 * Calculates Value at Risk (VaR) using historical method
 */
export const calculateVaR = (
  returns: number[],
  confidenceLevel: number = 0.95
): number => {
  if (returns.length === 0) return 0;

  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);

  return Math.abs(sortedReturns[index] || 0);
};

/**
 * Calculates Expected Shortfall (Conditional VaR)
 */
export const calculateExpectedShortfall = (
  returns: number[],
  confidenceLevel: number = 0.95
): number => {
  if (returns.length === 0) return 0;

  const sortedReturns = [...returns].sort((a, b) => a - b);
  const varIndex = Math.floor((1 - confidenceLevel) * sortedReturns.length);
  const tailReturns = sortedReturns.slice(0, varIndex + 1);

  if (tailReturns.length === 0) return 0;

  const avgTailReturn =
    tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length;
  return Math.abs(avgTailReturn);
};

/**
 * Calculates Kelly Criterion for optimal position sizing
 */
export const calculateKellyCriterion = (
  winRate: number,
  avgWin: number,
  avgLoss: number
): number => {
  if (avgLoss === 0) return 0;

  const winRateDecimal = winRate / 100;
  const lossRate = 1 - winRateDecimal;
  const winLossRatio = avgWin / Math.abs(avgLoss);

  return (winRateDecimal * winLossRatio - lossRate) / winLossRatio;
};
