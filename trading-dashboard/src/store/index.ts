import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { tradingApi } from "./api/tradingApi.js";
import dashboardReducer from "./slices/dashboardSlice.js";
import portfolioReducer from "./slices/portfolioSlice.js";
import systemReducer from "./slices/systemSlice.js";

export const store = configureStore({
  reducer: {
    // API slice
    [tradingApi.reducerPath]: tradingApi.reducer,

    // Feature slices
    dashboard: dashboardReducer,
    portfolio: portfolioReducer,
    system: systemReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }).concat(tradingApi.middleware),
});

// Enable listener behavior for the store
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
