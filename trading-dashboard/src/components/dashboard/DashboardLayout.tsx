import React, { type ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  HomeIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CpuChipIcon,
  CogIcon,
  Bars3Icon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { setTheme, toggleSidebar } from "../../store/slices/dashboardSlice";
import type { RootState } from "../../store";
import SystemStatusBar from "./SystemStatusBar";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: HomeIcon },
  { name: "Trading", href: "/trading", icon: ChartBarIcon },
  { name: "Performance", href: "/performance", icon: CurrencyDollarIcon },
  { name: "AI Analytics", href: "/ai-analytics", icon: CpuChipIcon },
  { name: "Settings", href: "/config", icon: CogIcon },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state: RootState) => state.dashboard.theme);
  const sidebarCollapsed = useAppSelector(
    (state: RootState) => state.dashboard.sidebarCollapsed
  );
  const location = useLocation();

  const isDarkMode =
    theme === "dark" ||
    (theme === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Apply theme to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handleSidebarToggle = () => {
    dispatch(toggleSidebar());
  };

  const handleThemeToggle = () => {
    dispatch(setTheme(isDarkMode ? "light" : "dark"));
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${!sidebarCollapsed ? "" : "hidden"}`}
      >
        <div
          className='fixed inset-0 bg-gray-600 bg-opacity-75'
          onClick={handleSidebarToggle}
        />
        <div className='relative flex w-64 flex-col bg-white dark:bg-gray-800 shadow-xl'>
          <div className='flex h-16 items-center justify-between px-4'>
            <h1 className='text-xl font-bold text-gray-900 dark:text-white'>
              AI Trading
            </h1>
            <button
              onClick={handleSidebarToggle}
              className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            >
              <XMarkIcon className='h-6 w-6' />
            </button>
          </div>
          <nav className='flex-1 space-y-1 px-2 py-4'>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? "bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  }`}
                  onClick={handleSidebarToggle}
                >
                  <item.icon className='mr-3 h-6 w-6 flex-shrink-0' />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className='hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col'>
        <div className='flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700'>
          <div className='flex h-16 items-center px-4'>
            <h1 className='text-xl font-bold text-gray-900 dark:text-white'>
              🤖 AI Trading System
            </h1>
          </div>
          <nav className='flex-1 space-y-1 px-2 py-4'>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? "bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  }`}
                >
                  <item.icon className='mr-3 h-6 w-6 flex-shrink-0' />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className='lg:pl-64'>
        {/* Top header */}
        <div className='sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8'>
            <div className='flex items-center'>
              <button
                onClick={handleSidebarToggle}
                className='text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 lg:hidden'
              >
                <Bars3Icon className='h-6 w-6' />
              </button>
              <h2 className='ml-4 text-lg font-semibold text-gray-900 dark:text-white lg:ml-0'>
                {navigation.find((item) => item.href === location.pathname)
                  ?.name || "Dashboard"}
              </h2>
            </div>

            <div className='flex items-center space-x-4'>
              <SystemStatusBar />
              <button
                onClick={handleThemeToggle}
                className='p-2 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300'
              >
                {isDarkMode ? (
                  <SunIcon className='h-5 w-5' />
                ) : (
                  <MoonIcon className='h-5 w-5' />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className='flex-1'>
          <div className='py-6'>
            <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
