/**
 * User preferences panel component
 */

import React from "react";
import {
  UserIcon,
  BellIcon,
  PaintBrushIcon,
  GlobeAltIcon,
  EyeIcon,
  SpeakerWaveIcon,
} from "@heroicons/react/24/outline";
import { BaseComponentProps } from "../../types/common/base";

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

interface UserPreferencesPanelProps extends BaseComponentProps {
  preferences: UserPreferences;
  notifications: NotificationPreferences;
  onPreferenceChange: (key: keyof UserPreferences, value: any) => void;
  onNotificationChange: (
    key: keyof NotificationPreferences,
    value: any
  ) => void;
  loading?: boolean;
  error?: string | null;
}

/**
 * Toggle switch component
 */
const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}> = ({ enabled, onChange, disabled = false }) => (
  <button
    onClick={() => !disabled && onChange(!enabled)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        enabled ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

/**
 * User preferences panel component
 */
export const UserPreferencesPanel: React.FC<UserPreferencesPanelProps> = ({
  preferences,
  notifications,
  onPreferenceChange,
  onNotificationChange,
  loading = false,
  error = null,
  className = "",
  testId,
}) => {
  const themes = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  const languages = [
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" },
    { value: "ja", label: "日本語" },
    { value: "zh", label: "中文" },
  ];

  const currencies = [
    { value: "USD", label: "US Dollar ($)" },
    { value: "EUR", label: "Euro (€)" },
    { value: "GBP", label: "British Pound (£)" },
    { value: "JPY", label: "Japanese Yen (¥)" },
    { value: "BTC", label: "Bitcoin (₿)" },
  ];

  const timezones = [
    { value: "UTC", label: "UTC" },
    { value: "America/New_York", label: "Eastern Time" },
    { value: "America/Chicago", label: "Central Time" },
    { value: "America/Denver", label: "Mountain Time" },
    { value: "America/Los_Angeles", label: "Pacific Time" },
    { value: "Europe/London", label: "London" },
    { value: "Europe/Paris", label: "Paris" },
    { value: "Asia/Tokyo", label: "Tokyo" },
    { value: "Asia/Shanghai", label: "Shanghai" },
  ];

  const notificationTypes = [
    { key: "TRADE_EXECUTED", label: "Trade Executed" },
    { key: "SIGNAL_GENERATED", label: "Signal Generated" },
    { key: "POSITION_CLOSED", label: "Position Closed" },
    { key: "SYSTEM_ERROR", label: "System Error" },
    { key: "EMERGENCY_EXIT", label: "Emergency Exit" },
    { key: "PRICE_ALERT", label: "Price Alert" },
    { key: "NEWS_UPDATE", label: "News Update" },
  ];

  const handleNotificationTypeToggle = (type: string, checked: boolean) => {
    const newTypes = checked
      ? [...notifications.types, type]
      : notifications.types.filter((t) => t !== type);
    onNotificationChange("types", newTypes);
  };

  if (loading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
        data-testid={testId}
      >
        <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center space-x-2'>
            <UserIcon className='h-5 w-5 text-primary-600' />
            <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
              User Preferences
            </h3>
          </div>
        </div>
        <div className='p-6'>
          <div className='animate-pulse space-y-6'>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className='h-16 bg-gray-200 dark:bg-gray-700 rounded'
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
        <div className='flex items-center space-x-2'>
          <UserIcon className='h-5 w-5 text-primary-600' />
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            User Preferences
          </h3>
        </div>
        {error && (
          <div className='mt-2 text-sm text-red-600 dark:text-red-400'>
            Error: {error}
          </div>
        )}
      </div>

      <div className='p-6 space-y-8'>
        {/* Appearance Settings */}
        <div>
          <div className='flex items-center space-x-2 mb-4'>
            <PaintBrushIcon className='h-4 w-4 text-gray-400' />
            <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
              Appearance
            </h4>
          </div>

          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
                Theme
              </label>
              <div className='grid grid-cols-3 gap-2'>
                {themes.map((theme) => (
                  <button
                    key={theme.value}
                    onClick={() => onPreferenceChange("theme", theme.value)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      preferences.theme === theme.value
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                        : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <span className='text-sm text-gray-900 dark:text-white'>
                    Animations
                  </span>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    Enable UI animations
                  </p>
                </div>
                <ToggleSwitch
                  enabled={preferences.animationsEnabled}
                  onChange={(enabled) =>
                    onPreferenceChange("animationsEnabled", enabled)
                  }
                />
              </div>

              <div className='flex items-center justify-between'>
                <div>
                  <span className='text-sm text-gray-900 dark:text-white'>
                    Compact Mode
                  </span>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    Reduce spacing and padding
                  </p>
                </div>
                <ToggleSwitch
                  enabled={preferences.compactMode}
                  onChange={(enabled) =>
                    onPreferenceChange("compactMode", enabled)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Localization Settings */}
        <div>
          <div className='flex items-center space-x-2 mb-4'>
            <GlobeAltIcon className='h-4 w-4 text-gray-400' />
            <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
              Localization
            </h4>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
                Language
              </label>
              <select
                value={preferences.language}
                onChange={(e) => onPreferenceChange("language", e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              >
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
                Timezone
              </label>
              <select
                value={preferences.timezone}
                onChange={(e) => onPreferenceChange("timezone", e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
                Currency
              </label>
              <select
                value={preferences.currency}
                onChange={(e) => onPreferenceChange("currency", e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              >
                {currencies.map((currency) => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
                Date Format
              </label>
              <select
                value={preferences.dateFormat}
                onChange={(e) =>
                  onPreferenceChange("dateFormat", e.target.value)
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              >
                <option value='MM/DD/YYYY'>MM/DD/YYYY</option>
                <option value='DD/MM/YYYY'>DD/MM/YYYY</option>
                <option value='YYYY-MM-DD'>YYYY-MM-DD</option>
                <option value='DD MMM YYYY'>DD MMM YYYY</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div>
          <div className='flex items-center space-x-2 mb-4'>
            <BellIcon className='h-4 w-4 text-gray-400' />
            <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
              Notifications
            </h4>
          </div>

          <div className='space-y-4'>
            {/* Enable Notifications */}
            <div className='flex items-center justify-between'>
              <div>
                <span className='text-sm font-medium text-gray-900 dark:text-white'>
                  Enable Notifications
                </span>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Receive alerts for trading events
                </p>
              </div>
              <ToggleSwitch
                enabled={notifications.enabled}
                onChange={(enabled) => onNotificationChange("enabled", enabled)}
              />
            </div>

            {/* Notification Types */}
            {notifications.enabled && (
              <>
                <div>
                  <label className='block text-sm font-medium text-gray-900 dark:text-white mb-3'>
                    Notification Types
                  </label>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                    {notificationTypes.map((type) => (
                      <label
                        key={type.key}
                        className='flex items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                      >
                        <input
                          type='checkbox'
                          checked={notifications.types.includes(type.key)}
                          onChange={(e) =>
                            handleNotificationTypeToggle(
                              type.key,
                              e.target.checked
                            )
                          }
                          className='h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded'
                        />
                        <span className='ml-2 text-sm text-gray-900 dark:text-white'>
                          {type.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Notification Methods */}
                <div>
                  <label className='block text-sm font-medium text-gray-900 dark:text-white mb-3'>
                    Notification Methods
                  </label>
                  <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-2'>
                        <SpeakerWaveIcon className='h-4 w-4 text-gray-400' />
                        <span className='text-sm text-gray-900 dark:text-white'>
                          Sound Alerts
                        </span>
                      </div>
                      <ToggleSwitch
                        enabled={notifications.sound}
                        onChange={(enabled) =>
                          onNotificationChange("sound", enabled)
                        }
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-2'>
                        <EyeIcon className='h-4 w-4 text-gray-400' />
                        <span className='text-sm text-gray-900 dark:text-white'>
                          Desktop Notifications
                        </span>
                      </div>
                      <ToggleSwitch
                        enabled={notifications.desktop}
                        onChange={(enabled) =>
                          onNotificationChange("desktop", enabled)
                        }
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-gray-900 dark:text-white'>
                        Email Notifications
                      </span>
                      <ToggleSwitch
                        enabled={notifications.email}
                        onChange={(enabled) =>
                          onNotificationChange("email", enabled)
                        }
                      />
                    </div>

                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-gray-900 dark:text-white'>
                        Push Notifications
                      </span>
                      <ToggleSwitch
                        enabled={notifications.pushNotifications}
                        onChange={(enabled) =>
                          onNotificationChange("pushNotifications", enabled)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Quiet Hours */}
                <div>
                  <div className='flex items-center justify-between mb-3'>
                    <label className='text-sm font-medium text-gray-900 dark:text-white'>
                      Quiet Hours
                    </label>
                    <ToggleSwitch
                      enabled={notifications.quietHours.enabled}
                      onChange={(enabled) =>
                        onNotificationChange("quietHours", {
                          ...notifications.quietHours,
                          enabled,
                        })
                      }
                    />
                  </div>

                  {notifications.quietHours.enabled && (
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>
                          Start Time
                        </label>
                        <input
                          type='time'
                          value={notifications.quietHours.start}
                          onChange={(e) =>
                            onNotificationChange("quietHours", {
                              ...notifications.quietHours,
                              start: e.target.value,
                            })
                          }
                          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                        />
                      </div>
                      <div>
                        <label className='block text-xs text-gray-500 dark:text-gray-400 mb-1'>
                          End Time
                        </label>
                        <input
                          type='time'
                          value={notifications.quietHours.end}
                          onChange={(e) =>
                            onNotificationChange("quietHours", {
                              ...notifications.quietHours,
                              end: e.target.value,
                            })
                          }
                          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Advanced Settings */}
        <div>
          <h4 className='text-sm font-medium text-gray-900 dark:text-white mb-4'>
            Advanced Settings
          </h4>

          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <span className='text-sm text-gray-900 dark:text-white'>
                  Show Advanced Features
                </span>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Display advanced trading tools and options
                </p>
              </div>
              <ToggleSwitch
                enabled={preferences.showAdvancedFeatures}
                onChange={(enabled) =>
                  onPreferenceChange("showAdvancedFeatures", enabled)
                }
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <span className='text-sm text-gray-900 dark:text-white'>
                  Auto Save
                </span>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  Automatically save changes
                </p>
              </div>
              <ToggleSwitch
                enabled={preferences.autoSave}
                onChange={(enabled) => onPreferenceChange("autoSave", enabled)}
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
                Session Timeout (minutes)
              </label>
              <input
                type='number'
                min='5'
                max='480'
                value={preferences.sessionTimeout}
                onChange={(e) =>
                  onPreferenceChange(
                    "sessionTimeout",
                    parseInt(e.target.value) || 30
                  )
                }
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
              <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
                Automatically log out after inactivity (5-480 minutes)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPreferencesPanel;
