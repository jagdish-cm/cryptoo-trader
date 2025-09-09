import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PanelConfig } from "../../types";

interface DashboardState {
  theme: "light" | "dark" | "auto";
  sidebarCollapsed: boolean;
  panels: PanelConfig[];
  selectedTimeframe: string;
  selectedSymbols: string[];
  notifications: {
    enabled: boolean;
    unreadCount: number;
    items: NotificationItem[];
  };
  filters: {
    dateRange: {
      start: string;
      end: string;
    };
    symbols: string[];
    tradeTypes: string[];
  };
}

interface NotificationItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const initialState: DashboardState = {
  theme: "dark",
  sidebarCollapsed: false,
  panels: [
    {
      id: "portfolio",
      type: "PORTFOLIO" as const,
      title: "Portfolio Overview",
      position: { x: 0, y: 0 },
      size: { width: 6, height: 4 },
      visible: true,
      settings: {},
    },
    {
      id: "positions",
      type: "POSITIONS" as const,
      title: "Active Positions",
      position: { x: 6, y: 0 },
      size: { width: 6, height: 4 },
      visible: true,
      settings: {},
    },
    {
      id: "chart",
      type: "CHART" as const,
      title: "Price Chart",
      position: { x: 0, y: 4 },
      size: { width: 8, height: 6 },
      visible: true,
      settings: {
        symbol: "BTC/USDT",
        timeframe: "1h",
        indicators: ["SMA", "RSI"],
      },
    },
    {
      id: "activity",
      type: "ACTIVITY_FEED" as const,
      title: "Trading Activity",
      position: { x: 8, y: 4 },
      size: { width: 4, height: 6 },
      visible: true,
      settings: {},
    },
  ],
  selectedTimeframe: "1h",
  selectedSymbols: ["BTC/USDT", "ETH/USDT"],
  notifications: {
    enabled: true,
    unreadCount: 0,
    items: [],
  },
  filters: {
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      end: new Date().toISOString(),
    },
    symbols: [],
    tradeTypes: [],
  },
};

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<"light" | "dark" | "auto">) => {
      state.theme = action.payload;
    },

    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },

    updatePanel: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<PanelConfig> }>
    ) => {
      const { id, updates } = action.payload;
      const panelIndex = state.panels.findIndex((panel) => panel.id === id);
      if (panelIndex !== -1) {
        state.panels[panelIndex] = { ...state.panels[panelIndex], ...updates };
      }
    },

    addPanel: (state, action: PayloadAction<PanelConfig>) => {
      state.panels.push(action.payload);
    },

    removePanel: (state, action: PayloadAction<string>) => {
      state.panels = state.panels.filter(
        (panel) => panel.id !== action.payload
      );
    },

    reorderPanels: (state, action: PayloadAction<PanelConfig[]>) => {
      state.panels = action.payload;
    },

    setSelectedTimeframe: (state, action: PayloadAction<string>) => {
      state.selectedTimeframe = action.payload;
    },

    setSelectedSymbols: (state, action: PayloadAction<string[]>) => {
      state.selectedSymbols = action.payload;
    },

    addSelectedSymbol: (state, action: PayloadAction<string>) => {
      if (!state.selectedSymbols.includes(action.payload)) {
        state.selectedSymbols.push(action.payload);
      }
    },

    removeSelectedSymbol: (state, action: PayloadAction<string>) => {
      state.selectedSymbols = state.selectedSymbols.filter(
        (symbol) => symbol !== action.payload
      );
    },

    addNotification: (
      state,
      action: PayloadAction<Omit<NotificationItem, "id" | "timestamp" | "read">>
    ) => {
      const notification: NotificationItem = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        read: false,
      };
      state.notifications.items.unshift(notification);
      state.notifications.unreadCount += 1;

      // Keep only the last 100 notifications
      if (state.notifications.items.length > 100) {
        state.notifications.items = state.notifications.items.slice(0, 100);
      }
    },

    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.items.find(
        (item) => item.id === action.payload
      );
      if (notification && !notification.read) {
        notification.read = true;
        state.notifications.unreadCount = Math.max(
          0,
          state.notifications.unreadCount - 1
        );
      }
    },

    markAllNotificationsAsRead: (state) => {
      state.notifications.items.forEach((item) => {
        item.read = true;
      });
      state.notifications.unreadCount = 0;
    },

    clearNotifications: (state) => {
      state.notifications.items = [];
      state.notifications.unreadCount = 0;
    },

    setNotificationsEnabled: (state, action: PayloadAction<boolean>) => {
      state.notifications.enabled = action.payload;
    },

    updateFilters: (
      state,
      action: PayloadAction<Partial<DashboardState["filters"]>>
    ) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebarCollapsed,
  updatePanel,
  addPanel,
  removePanel,
  reorderPanels,
  setSelectedTimeframe,
  setSelectedSymbols,
  addSelectedSymbol,
  removeSelectedSymbol,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotifications,
  setNotificationsEnabled,
  updateFilters,
  resetFilters,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
