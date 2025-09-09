/**
 * Custom hook for managing configuration data
 */

import { useState, useEffect, useCallback } from "react";
import { TradingConfig, NotificationConfig } from "../../types";

interface SystemConfig {
  apiEndpoint: string;
  websocketUrl: string;
  dataRetentionDays: number;
  logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  maxConcurrentConnections: number;
  enableSSL: boolean;
  autoReconnect: boolean;
  heartbeatInterval: number;
}

interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  compactMode: boolean;
  showAdvancedFeatures: boolean;
  autoSave: boolean;
  sessionTimeout: number;
}

interface NotificationPreferences {
  enabled: boolean;
  types: string[];
  sound: boolean;
  desktop: boolean;
  email: boolean;
  pushNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

interface SystemStatus {
  version: string;
  uptime: string;
  lastUpdated: string;
  status: "operational" | "degraded" | "down";
  connections: number;
}

interface UseConfigDataOptions {
  autoSave?: boolean;
  saveDelay?: number;
}

interface UseConfigDataReturn {
  // Configuration data
  tradingConfig: TradingConfig;
  systemConfig: SystemConfig;
  userPreferences: UserPreferences;
  notificationPreferences: NotificationPreferences;
  systemStatus: SystemStatus;

  // State
  loading: boolean;
  saving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;

  // Actions
  updateTradingConfig: (key: keyof TradingConfig, value: any) => void;
  updateSystemConfig: (key: keyof SystemConfig, value: any) => void;
  updateUserPreferences: (key: keyof UserPreferences, value: any) => void;
  updateNotificationPreferences: (
    key: keyof NotificationPreferences,
    value: any
  ) => void;
  saveAllConfigs: () => Promise<void>;
  resetToDefaults: () => void;
  refresh: () => void;
  emergencyStop: () => void;
}

// Default configurations
const defaultTradingConfig: TradingConfig = {
  autoTrading: false,
  maxPositions: 5,
  riskPerTrade: 2.0,
  emergencyStop: false,
  allowedSymbols: ["BTC/USDT", "ETH/USDT"],
  maxLeverage: 3.0,
  stopLossPercentage: 5.0,
  takeProfitPercentage: 10.0,
};

const defaultSystemConfig: SystemConfig = {
  apiEndpoint: "https://api.trading-system.com",
  websocketUrl: "wss://ws.trading-system.com",
  dataRetentionDays: 90,
  logLevel: "INFO",
  maxConcurrentConnections: 10,
  enableSSL: true,
  autoReconnect: true,
  heartbeatInterval: 30,
};

const defaultUserPreferences: UserPreferences = {
  theme: "system",
  language: "en",
  timezone: "UTC",
  dateFormat: "MM/DD/YYYY",
  currency: "USD",
  soundEnabled: true,
  animationsEnabled: true,
  compactMode: false,
  showAdvancedFeatures: false,
  autoSave: true,
  sessionTimeout: 60,
};

const defaultNotificationPreferences: NotificationPreferences = {
  enabled: true,
  types: ["TRADE_EXECUTED", "SIGNAL_GENERATED", "SYSTEM_ERROR"],
  sound: true,
  desktop: true,
  email: false,
  pushNotifications: false,
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
};

/**
 * Fetch real system status from API
 */
const fetchSystemStatus = async (): Promise<SystemStatus> => {
  try {
    const response = await fetch("/api/system/status");
    if (!response.ok) {
      throw new Error("Failed to fetch system status");
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch system status:", error);
    // Return minimal status when API fails
    return {
      version: "unknown",
      uptime: "unknown",
      lastUpdated: new Date().toISOString(),
      status: "unknown",
      connections: 0,
    };
  }
};

/**
 * Hook for managing configuration data
 */
export const useConfigData = (
  options: UseConfigDataOptions = {}
): UseConfigDataReturn => {
  const { autoSave = true, saveDelay = 2000 } = options;

  // State
  const [tradingConfig, setTradingConfig] =
    useState<TradingConfig>(defaultTradingConfig);
  const [systemConfig, setSystemConfig] =
    useState<SystemConfig>(defaultSystemConfig);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(
    defaultUserPreferences
  );
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(defaultNotificationPreferences);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    version: "unknown",
    uptime: "unknown",
    lastUpdated: new Date().toISOString(),
    status: "unknown",
    connections: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load configuration data
  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Load from localStorage or use defaults
      const savedTradingConfig = localStorage.getItem("tradingConfig");
      const savedSystemConfig = localStorage.getItem("systemConfig");
      const savedUserPreferences = localStorage.getItem("userPreferences");
      const savedNotificationPreferences = localStorage.getItem(
        "notificationPreferences"
      );

      if (savedTradingConfig) {
        setTradingConfig(JSON.parse(savedTradingConfig));
      }
      if (savedSystemConfig) {
        setSystemConfig(JSON.parse(savedSystemConfig));
      }
      if (savedUserPreferences) {
        setUserPreferences(JSON.parse(savedUserPreferences));
      }
      if (savedNotificationPreferences) {
        setNotificationPreferences(JSON.parse(savedNotificationPreferences));
      }

      // Update system status
      const status = await fetchSystemStatus();
      setSystemStatus(status);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load configuration"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Save configuration data
  const saveAllConfigs = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Save to localStorage
      localStorage.setItem("tradingConfig", JSON.stringify(tradingConfig));
      localStorage.setItem("systemConfig", JSON.stringify(systemConfig));
      localStorage.setItem("userPreferences", JSON.stringify(userPreferences));
      localStorage.setItem(
        "notificationPreferences",
        JSON.stringify(notificationPreferences)
      );

      setHasUnsavedChanges(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setSaving(false);
    }
  }, [tradingConfig, systemConfig, userPreferences, notificationPreferences]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && hasUnsavedChanges && !loading) {
      const timeoutId = setTimeout(() => {
        saveAllConfigs();
      }, saveDelay);

      return () => clearTimeout(timeoutId);
    }
  }, [autoSave, hasUnsavedChanges, loading, saveDelay, saveAllConfigs]);

  // Update functions
  const updateTradingConfig = useCallback(
    (key: keyof TradingConfig, value: any) => {
      setTradingConfig((prev) => ({ ...prev, [key]: value }));
      setHasUnsavedChanges(true);
    },
    []
  );

  const updateSystemConfig = useCallback(
    (key: keyof SystemConfig, value: any) => {
      setSystemConfig((prev) => ({ ...prev, [key]: value }));
      setHasUnsavedChanges(true);
    },
    []
  );

  const updateUserPreferences = useCallback(
    (key: keyof UserPreferences, value: any) => {
      setUserPreferences((prev) => ({ ...prev, [key]: value }));
      setHasUnsavedChanges(true);
    },
    []
  );

  const updateNotificationPreferences = useCallback(
    (key: keyof NotificationPreferences, value: any) => {
      setNotificationPreferences((prev) => ({ ...prev, [key]: value }));
      setHasUnsavedChanges(true);
    },
    []
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setTradingConfig(defaultTradingConfig);
    setSystemConfig(defaultSystemConfig);
    setUserPreferences(defaultUserPreferences);
    setNotificationPreferences(defaultNotificationPreferences);
    setHasUnsavedChanges(true);
  }, []);

  // Emergency stop
  const emergencyStop = useCallback(() => {
    setTradingConfig((prev) => ({
      ...prev,
      emergencyStop: true,
      autoTrading: false,
    }));
    setHasUnsavedChanges(true);
    // Immediately save emergency stop
    saveAllConfigs();
  }, [saveAllConfigs]);

  // Refresh system status
  const refresh = useCallback(async () => {
    const status = await fetchSystemStatus();
    setSystemStatus(status);
    loadConfigs();
  }, [loadConfigs]);

  // Initial load
  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Periodic system status updates
  useEffect(() => {
    const interval = setInterval(async () => {
      const status = await fetchSystemStatus();
      setSystemStatus(status);
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    // Configuration data
    tradingConfig,
    systemConfig,
    userPreferences,
    notificationPreferences,
    systemStatus,

    // State
    loading,
    saving,
    error,
    hasUnsavedChanges,

    // Actions
    updateTradingConfig,
    updateSystemConfig,
    updateUserPreferences,
    updateNotificationPreferences,
    saveAllConfigs,
    resetToDefaults,
    refresh,
    emergencyStop,
  };
};

export default useConfigData;
