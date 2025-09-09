import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Portfolio, Position, Trade } from "../../types";

interface PortfolioState {
  currentPortfolio: Portfolio | null;
  positions: Position[];
  recentTrades: Trade[];
  selectedPosition: string | null;
  portfolioHistory: {
    timestamp: string;
    value: number;
    pnl: number;
  }[];
  performanceMetrics: {
    totalReturn: number;
    dailyPnL: number;
    weeklyPnL: number;
    monthlyPnL: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  } | null;
  alerts: {
    id: string;
    type: "profit_target" | "stop_loss" | "drawdown" | "exposure";
    message: string;
    severity: "low" | "medium" | "high" | "critical";
    timestamp: string;
    acknowledged: boolean;
  }[];
}

const initialState: PortfolioState = {
  currentPortfolio: null,
  positions: [],
  recentTrades: [],
  selectedPosition: null,
  portfolioHistory: [],
  performanceMetrics: null,
  alerts: [],
};

const portfolioSlice = createSlice({
  name: "portfolio",
  initialState,
  reducers: {
    setPortfolio: (state, action: PayloadAction<Portfolio>) => {
      state.currentPortfolio = action.payload;

      // Add to portfolio history
      state.portfolioHistory.push({
        timestamp: new Date().toISOString(),
        value: action.payload.totalValue,
        pnl: action.payload.dailyPnL,
      });

      // Keep only the last 1000 entries
      if (state.portfolioHistory.length > 1000) {
        state.portfolioHistory = state.portfolioHistory.slice(-1000);
      }
    },

    setPositions: (state, action: PayloadAction<Position[]>) => {
      state.positions = action.payload;
    },

    updatePosition: (state, action: PayloadAction<Position>) => {
      const index = state.positions.findIndex(
        (pos) => pos.id === action.payload.id
      );
      if (index !== -1) {
        state.positions[index] = action.payload;
      } else {
        state.positions.push(action.payload);
      }
    },

    removePosition: (state, action: PayloadAction<string>) => {
      state.positions = state.positions.filter(
        (pos) => pos.id !== action.payload
      );
    },

    setSelectedPosition: (state, action: PayloadAction<string | null>) => {
      state.selectedPosition = action.payload;
    },

    addTrade: (state, action: PayloadAction<Trade>) => {
      state.recentTrades.unshift(action.payload);

      // Keep only the last 100 trades
      if (state.recentTrades.length > 100) {
        state.recentTrades = state.recentTrades.slice(0, 100);
      }
    },

    setRecentTrades: (state, action: PayloadAction<Trade[]>) => {
      state.recentTrades = action.payload;
    },

    setPerformanceMetrics: (
      state,
      action: PayloadAction<PortfolioState["performanceMetrics"]>
    ) => {
      state.performanceMetrics = action.payload;
    },

    addAlert: (
      state,
      action: PayloadAction<
        Omit<PortfolioState["alerts"][0], "id" | "timestamp" | "acknowledged">
      >
    ) => {
      const alert = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };
      state.alerts.unshift(alert);

      // Keep only the last 50 alerts
      if (state.alerts.length > 50) {
        state.alerts = state.alerts.slice(0, 50);
      }
    },

    acknowledgeAlert: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find((alert) => alert.id === action.payload);
      if (alert) {
        alert.acknowledged = true;
      }
    },

    clearAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(
        (alert) => alert.id !== action.payload
      );
    },

    clearAllAlerts: (state) => {
      state.alerts = [];
    },

    // Real-time updates from WebSocket
    updatePortfolioValue: (
      state,
      action: PayloadAction<{ totalValue: number; dailyPnL: number }>
    ) => {
      if (state.currentPortfolio) {
        state.currentPortfolio.totalValue = action.payload.totalValue;
        state.currentPortfolio.dailyPnL = action.payload.dailyPnL;
        state.currentPortfolio.lastUpdated = new Date();
      }
    },

    updatePositionPnL: (
      state,
      action: PayloadAction<{
        positionId: string;
        unrealizedPnL: number;
        currentPrice: number;
      }>
    ) => {
      const position = state.positions.find(
        (pos) => pos.id === action.payload.positionId
      );
      if (position) {
        position.unrealizedPnL = action.payload.unrealizedPnL;
        position.currentPrice = action.payload.currentPrice;
        position.updatedAt = new Date();
      }
    },

    // Portfolio analysis
    calculateRiskMetrics: (state) => {
      if (state.positions.length === 0 || !state.currentPortfolio) return;

      const totalExposure = state.positions.reduce(
        (sum, pos) => sum + Math.abs(pos.quantity * pos.currentPrice),
        0
      );

      const portfolioValue = state.currentPortfolio.totalValue;
      const exposureRatio = totalExposure / portfolioValue;

      // Add high exposure alert
      if (exposureRatio > 0.8) {
        const existingAlert = state.alerts.find(
          (alert) => alert.type === "exposure" && !alert.acknowledged
        );

        if (!existingAlert) {
          state.alerts.unshift({
            id: Date.now().toString(),
            type: "exposure",
            message: `High portfolio exposure: ${(exposureRatio * 100).toFixed(1)}%`,
            severity: exposureRatio > 0.9 ? "critical" : "high",
            timestamp: new Date().toISOString(),
            acknowledged: false,
          });
        }
      }
    },
  },
});

export const {
  setPortfolio,
  setPositions,
  updatePosition,
  removePosition,
  setSelectedPosition,
  addTrade,
  setRecentTrades,
  setPerformanceMetrics,
  addAlert,
  acknowledgeAlert,
  clearAlert,
  clearAllAlerts,
  updatePortfolioValue,
  updatePositionPnL,
  calculateRiskMetrics,
} = portfolioSlice.actions;

export default portfolioSlice.reducer;
