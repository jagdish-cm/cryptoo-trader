import React, { useState } from "react";
import {
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// Import new components
import TradingConfigPanel from "../components/config/TradingConfigPanel";
import SystemConfigPanel from "../components/config/SystemConfigPanel";
import UserPreferencesPanel from "../components/config/UserPreferencesPanel";

// Import new hook
import { useConfigData } from "../hooks/config/useConfigData";

const ConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "trading" | "system" | "preferences"
  >("trading");

  // Use the configuration data hook
  const {
    tradingConfig,
    systemConfig,
    userPreferences,
    notificationPreferences,
    systemStatus,
    loading,
    saving,
    error,
    hasUnsavedChanges,
    updateTradingConfig,
    updateSystemConfig,
    updateUserPreferences,
    updateNotificationPreferences,
    saveAllConfigs,
    resetToDefaults,
    refresh,
    emergencyStop,
  } = useConfigData({
    autoSave: true,
    saveDelay: 2000,
  });

  const tabs = [
    { key: "trading", label: "Trading", icon: CogIcon },
    { key: "system", label: "System", icon: CheckCircleIcon },
    { key: "preferences", label: "Preferences", icon: ExclamationTriangleIcon },
  ];

  const handleSave = async () => {
    await saveAllConfigs();
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600'></div>
        <span className='ml-3 text-gray-600 dark:text-gray-400'>
          Loading configuration...
        </span>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            <CogIcon className='h-8 w-8 text-primary-600' />
            <div>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
                System Configuration
              </h1>
              <p className='text-gray-500 dark:text-gray-400'>
                Manage trading parameters, system settings, and user preferences
              </p>
            </div>
          </div>

          <div className='flex items-center space-x-3'>
            {/* Status Indicators */}
            {saving && (
              <div className='flex items-center space-x-2 text-blue-600 dark:text-blue-400'>
                <ArrowPathIcon className='h-4 w-4 animate-spin' />
                <span className='text-sm font-medium'>Saving...</span>
              </div>
            )}

            {hasUnsavedChanges && !saving && (
              <div className='flex items-center space-x-2 text-yellow-600 dark:text-yellow-400'>
                <ExclamationTriangleIcon className='h-4 w-4' />
                <span className='text-sm font-medium'>Unsaved changes</span>
              </div>
            )}

            {!hasUnsavedChanges && !saving && !loading && (
              <div className='flex items-center space-x-2 text-green-600 dark:text-green-400'>
                <CheckCircleIcon className='h-4 w-4' />
                <span className='text-sm font-medium'>All changes saved</span>
              </div>
            )}

            {/* Action Buttons */}
            <button
              onClick={refresh}
              className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
              title='Refresh'
            >
              <ArrowPathIcon className='h-4 w-4' />
            </button>

            <button
              onClick={resetToDefaults}
              className='px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
            >
              Reset to Defaults
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className='px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className='mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
            <div className='text-red-800 dark:text-red-200'>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
        <div className='border-b border-gray-200 dark:border-gray-700'>
          <nav className='flex space-x-8 px-6' aria-label='Tabs'>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() =>
                    setActiveTab(
                      tab.key as "system" | "preferences" | "trading"
                    )
                  }
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.key
                      ? "border-primary-500 text-primary-600 dark:text-primary-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  <Icon className='h-4 w-4' />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className='p-6'>
          {activeTab === "trading" && (
            <TradingConfigPanel
              config={tradingConfig}
              onConfigChange={updateTradingConfig}
              onEmergencyStop={emergencyStop}
              loading={loading}
              error={error}
            />
          )}

          {activeTab === "system" && (
            <SystemConfigPanel
              config={systemConfig}
              onConfigChange={updateSystemConfig}
              systemStatus={systemStatus}
              loading={loading}
              error={error}
            />
          )}

          {activeTab === "preferences" && (
            <UserPreferencesPanel
              preferences={userPreferences}
              notifications={notificationPreferences}
              onPreferenceChange={updateUserPreferences}
              onNotificationChange={updateNotificationPreferences}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigPage;
