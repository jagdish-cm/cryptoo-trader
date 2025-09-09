/**
 * Component preloading utilities for better performance
 */

// Define preloadable components
export const preloadableComponents = {
  // Page components
  HomePage: () => import("../../pages/HomePage"),
  TradingPage: () => import("../../pages/TradingPage"),
  PortfolioPage: () => import("../../pages/PortfolioPage"),
  PerformancePage: () => import("../../pages/PerformancePage"),
  AIAnalyticsPage: () => import("../../pages/AIAnalyticsPage"),
  ConfigPage: () => import("../../pages/ConfigPage"),

  // Heavy analytics components
  AIDecisionOverview: () =>
    import("../../components/analytics/AIDecisionOverview"),
  AIDecisionsList: () => import("../../components/analytics/AIDecisionsList"),
  AIModelPerformance: () =>
    import("../../components/analytics/AIModelPerformance"),
  ExecutionThresholdVisualization: () =>
    import("../../components/analytics/ExecutionThresholdVisualization"),

  // Trading components
  PositionsPanel: () =>
    import("../../components/trading/positions/PositionsPanel"),
  SignalsPanel: () => import("../../components/trading/signals/SignalsPanel"),
  MarketDataPanel: () =>
    import("../../components/trading/market-data/MarketDataPanel"),
  TradingControls: () =>
    import("../../components/trading/controls/TradingControls"),

  // Performance components
  PerformanceDashboard: () =>
    import("../../pages/components/performance/PerformanceDashboard").then(
      (module) => ({ default: module.PerformanceDashboard })
    ),
  // TradeHistoryPanel: () =>
  //   import("../../components/trading/history/TradeHistoryPanel").then(
  //     (module) => ({ default: module.TradeHistoryPanel })
  //   ),
  // MetricsPanel: () =>
  //   import("../../components/analytics/performance/MetricsPanel").then(
  //     (module) => ({ default: module.MetricsPanel })
  //   ),
  ChartsPanel: () =>
    import("../../components/analytics/charts/ChartsPanel").then((module) => ({
      default: module.ChartsPanel,
    })),
} as const;

export type PreloadableComponent = keyof typeof preloadableComponents;

/**
 * Preload a specific component
 */
export const preloadComponent = async (
  componentName: PreloadableComponent
): Promise<void> => {
  try {
    await preloadableComponents[componentName]();
    console.log(`✅ Preloaded component: ${componentName}`);
  } catch (error) {
    console.warn(`⚠️ Failed to preload component: ${componentName}`, error);
  }
};

/**
 * Preload multiple components
 */
export const preloadComponents = async (
  componentNames: PreloadableComponent[]
): Promise<void> => {
  const preloadPromises = componentNames.map((name) => preloadComponent(name));
  await Promise.allSettled(preloadPromises);
};

/**
 * Preload components based on current route
 */
export const preloadForRoute = async (currentPath: string): Promise<void> => {
  const routePreloadMap: Record<string, PreloadableComponent[]> = {
    "/": ["TradingPage", "PortfolioPage"], // From home, likely to go to trading or portfolio
    "/trading": [
      "PositionsPanel",
      "SignalsPanel",
      "MarketDataPanel",
      "PerformancePage",
    ],
    "/portfolio": ["PerformancePage", "TradingPage"],
    "/performance": [
      "PerformanceDashboard",
      // "TradeHistoryPanel", // Will be implemented
      // "MetricsPanel", // Will be implemented
      "ChartsPanel",
    ],
    "/ai-analytics": [
      "AIDecisionOverview",
      "AIDecisionsList",
      "AIModelPerformance",
      "ExecutionThresholdVisualization",
    ],
    "/config": ["TradingPage"], // After config, likely to go back to trading
  };

  const componentsToPreload = routePreloadMap[currentPath] || [];
  if (componentsToPreload.length > 0) {
    console.log(`🚀 Preloading components for route: ${currentPath}`);
    await preloadComponents(componentsToPreload);
  }
};

/**
 * Preload critical components on app initialization
 */
export const preloadCriticalComponents = async (): Promise<void> => {
  const criticalComponents: PreloadableComponent[] = [
    "TradingPage",
    "PortfolioPage",
    "PositionsPanel",
    "MarketDataPanel",
  ];

  console.log("🚀 Preloading critical components...");
  await preloadComponents(criticalComponents);
};

/**
 * Preload components on user interaction (hover, focus)
 */
export const preloadOnInteraction = (componentName: PreloadableComponent) => {
  let preloaded = false;

  return {
    onMouseEnter: () => {
      if (!preloaded) {
        preloaded = true;
        preloadComponent(componentName);
      }
    },
    onFocus: () => {
      if (!preloaded) {
        preloaded = true;
        preloadComponent(componentName);
      }
    },
  };
};

/**
 * Preload components during idle time
 */
export const preloadDuringIdle = (
  componentNames: PreloadableComponent[]
): void => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => {
      preloadComponents(componentNames);
    });
  } else {
    // Fallback for browsers that don't support requestIdleCallback
    setTimeout(() => {
      preloadComponents(componentNames);
    }, 2000);
  }
};

/**
 * Smart preloading based on user behavior patterns
 */
export class SmartPreloader {
  private visitHistory: string[] = [];
  private preloadedComponents = new Set<PreloadableComponent>();

  recordVisit(path: string): void {
    this.visitHistory.push(path);
    // Keep only last 10 visits
    if (this.visitHistory.length > 10) {
      this.visitHistory.shift();
    }

    // Predict next likely route and preload
    this.predictAndPreload();
  }

  private predictAndPreload(): void {
    const recentVisits = this.visitHistory.slice(-3);
    const patterns: Record<string, PreloadableComponent[]> = {
      // If user visits trading -> performance frequently, preload performance components
      "trading-performance": [
        "PerformanceDashboard",
        // "MetricsPanel", // Will be implemented
        "ChartsPanel",
      ],
      // If user visits ai-analytics -> trading, preload trading components
      "ai-analytics-trading": [
        "PositionsPanel",
        "SignalsPanel",
        "TradingControls",
      ],
      // If user visits portfolio -> trading, preload trading components
      "portfolio-trading": ["MarketDataPanel", "TradingControls"],
    };

    // Simple pattern matching
    const visitPattern = recentVisits.join("-").replace(/\//g, "");
    const componentsToPreload = patterns[visitPattern];

    if (componentsToPreload) {
      const newComponents = componentsToPreload.filter(
        (comp) => !this.preloadedComponents.has(comp)
      );

      if (newComponents.length > 0) {
        console.log(`🧠 Smart preloading based on pattern: ${visitPattern}`);
        preloadComponents(newComponents);
        newComponents.forEach((comp) => this.preloadedComponents.add(comp));
      }
    }
  }

  reset(): void {
    this.visitHistory = [];
    this.preloadedComponents.clear();
  }
}

// Global smart preloader instance
export const smartPreloader = new SmartPreloader();
