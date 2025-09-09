import React, { Suspense, useEffect } from "react";
import { Provider } from "react-redux";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { store } from "./store";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import { LazyLoadFallback } from "./components/ui/feedback/LazyLoadFallback";
import {
  preloadCriticalComponents,
  preloadForRoute,
  smartPreloader,
} from "./utils/preloading/componentPreloader";
import "./App.css";

// Lazy load page components for better performance
const HomePage = React.lazy(() => import("./pages/HomePage"));
const TradingPage = React.lazy(() => import("./pages/TradingPage"));
const PerformancePage = React.lazy(() => import("./pages/PerformancePage"));
const AIAnalyticsPage = React.lazy(() => import("./pages/AIAnalyticsPage"));
const ConfigPage = React.lazy(() => import("./pages/ConfigPage"));
const PortfolioPage = React.lazy(() => import("./pages/PortfolioPage"));

/**
 * Component to handle preloading logic based on route changes
 */
const PreloadingManager: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();

  useEffect(() => {
    // Record visit for smart preloading
    smartPreloader.recordVisit(location.pathname);

    // Preload components for current route
    preloadForRoute(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    // Preload critical components on app initialization
    preloadCriticalComponents();
  }, []);

  return <>{children}</>;
};

function App() {
  return (
    <Provider store={store}>
      <WebSocketProvider autoConnect={true}>
        <Router>
          <PreloadingManager>
            <DashboardLayout>
              <Suspense fallback={<LazyLoadFallback />}>
                <Routes>
                  <Route path='/' element={<HomePage />} />
                  <Route path='/trading' element={<TradingPage />} />
                  <Route path='/portfolio' element={<PortfolioPage />} />
                  <Route path='/performance' element={<PerformancePage />} />
                  <Route path='/ai-analytics' element={<AIAnalyticsPage />} />
                  <Route path='/config' element={<ConfigPage />} />
                </Routes>
              </Suspense>
            </DashboardLayout>
          </PreloadingManager>
        </Router>
      </WebSocketProvider>
    </Provider>
  );
}

export default App;
