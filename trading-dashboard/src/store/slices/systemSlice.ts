import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  SystemStatus,
  SystemError,
  TradingSignal,
  AIDecision,
} from "../../types";

interface SystemState {
  status: SystemStatus | null;
  connected: boolean;
  lastHeartbeat: string | null;
  errors: SystemError[];
  activeSignals: TradingSignal[];
  recentDecisions: AIDecision[];
  systemLogs: {
    id: string;
    timestamp: string;
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    component: string;
    message: string;
    details?: any;
  }[];
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
    apiResponseTime: number;
    dbResponseTime: number;
  } | null;
  marketRegime: {
    current: "bull" | "bear" | "range" | "unknown";
    confidence: number;
    trendStrength: "weak" | "moderate" | "strong";
    volatility: "low" | "moderate" | "high";
    lastUpdate: string;
  } | null;
}

const initialState: SystemState = {
  status: null,
  connected: false,
  lastHeartbeat: null,
  errors: [],
  activeSignals: [],
  recentDecisions: [],
  systemLogs: [],
  performance: null,
  marketRegime: null,
};

const systemSlice = createSlice({
  name: "system",
  initialState,
  reducers: {
    setSystemStatus: (state, action: PayloadAction<SystemStatus>) => {
      state.status = action.payload;
      state.lastHeartbeat = new Date().toISOString();
    },

    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
      if (action.payload) {
        state.lastHeartbeat = new Date().toISOString();
      }
    },

    updateHeartbeat: (state) => {
      state.lastHeartbeat = new Date().toISOString();
    },

    addError: (
      state,
      action: PayloadAction<Omit<SystemError, "id" | "timestamp">>
    ) => {
      const error: SystemError = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date(),
      };
      state.errors.unshift(error);

      // Keep only the last 100 errors
      if (state.errors.length > 100) {
        state.errors = state.errors.slice(0, 100);
      }
    },

    clearError: (state, action: PayloadAction<string>) => {
      state.errors = state.errors.filter(
        (error) => error.id !== action.payload
      );
    },

    clearAllErrors: (state) => {
      state.errors = [];
    },

    setActiveSignals: (state, action: PayloadAction<TradingSignal[]>) => {
      state.activeSignals = action.payload;
    },

    addSignal: (state, action: PayloadAction<TradingSignal>) => {
      // Remove any existing signal for the same symbol
      state.activeSignals = state.activeSignals.filter(
        (signal) => signal.symbol !== action.payload.symbol
      );
      state.activeSignals.unshift(action.payload);
    },

    removeSignal: (state, action: PayloadAction<string>) => {
      state.activeSignals = state.activeSignals.filter(
        (signal) => signal.id !== action.payload
      );
    },

    setRecentDecisions: (state, action: PayloadAction<AIDecision[]>) => {
      state.recentDecisions = action.payload;
    },

    addDecision: (state, action: PayloadAction<AIDecision>) => {
      state.recentDecisions.unshift(action.payload);

      // Keep only the last 50 decisions
      if (state.recentDecisions.length > 50) {
        state.recentDecisions = state.recentDecisions.slice(0, 50);
      }
    },

    addSystemLog: (
      state,
      action: PayloadAction<
        Omit<SystemState["systemLogs"][0], "id" | "timestamp">
      >
    ) => {
      const log = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
      };
      state.systemLogs.unshift(log);

      // Keep only the last 500 logs
      if (state.systemLogs.length > 500) {
        state.systemLogs = state.systemLogs.slice(0, 500);
      }
    },

    clearSystemLogs: (state) => {
      state.systemLogs = [];
    },

    setPerformanceMetrics: (
      state,
      action: PayloadAction<SystemState["performance"]>
    ) => {
      state.performance = action.payload;
    },

    setMarketRegime: (
      state,
      action: PayloadAction<SystemState["marketRegime"]>
    ) => {
      state.marketRegime = action.payload;
    },

    // WebSocket event handlers
    handleWebSocketMessage: (
      state,
      action: PayloadAction<{ type: string; data: any }>
    ) => {
      const { type, data } = action.payload;

      switch (type) {
        case "system_status":
          state.status = data;
          state.lastHeartbeat = new Date().toISOString();
          break;

        case "signal_generated":
          // Remove any existing signal for the same symbol
          state.activeSignals = state.activeSignals.filter(
            (signal) => signal.symbol !== data.symbol
          );
          state.activeSignals.unshift(data);
          break;

        case "ai_decision":
          state.recentDecisions.unshift(data);
          if (state.recentDecisions.length > 50) {
            state.recentDecisions = state.recentDecisions.slice(0, 50);
          }
          break;

        case "regime_change":
          state.marketRegime = {
            ...data,
            lastUpdate: new Date().toISOString(),
          };
          break;

        case "system_error":
          const error: SystemError = {
            ...data,
            id: Date.now().toString(),
            timestamp: new Date(),
          };
          state.errors.unshift(error);
          if (state.errors.length > 100) {
            state.errors = state.errors.slice(0, 100);
          }
          break;

        default:
          // Log unknown message types
          state.systemLogs.unshift({
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            level: "DEBUG",
            component: "WebSocket",
            message: `Unknown message type: ${type}`,
            details: data,
          });
          break;
      }
    },

    // System control actions
    systemStartRequested: (state) => {
      state.systemLogs.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: "INFO",
        component: "System",
        message: "System start requested",
      });
    },

    systemStopRequested: (state) => {
      state.systemLogs.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: "INFO",
        component: "System",
        message: "System stop requested",
      });
    },

    emergencyStopRequested: (state) => {
      state.systemLogs.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: "CRITICAL",
        component: "System",
        message: "Emergency stop requested",
      });
    },
  },
});

export const {
  setSystemStatus,
  setConnected,
  updateHeartbeat,
  addError,
  clearError,
  clearAllErrors,
  setActiveSignals,
  addSignal,
  removeSignal,
  setRecentDecisions,
  addDecision,
  addSystemLog,
  clearSystemLogs,
  setPerformanceMetrics,
  setMarketRegime,
  handleWebSocketMessage,
  systemStartRequested,
  systemStopRequested,
  emergencyStopRequested,
} = systemSlice.actions;

export default systemSlice.reducer;
