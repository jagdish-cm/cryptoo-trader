/**
 * WebSocket optimization utilities for efficient subscription management and data caching
 */

import { useRef, useEffect, useCallback, useMemo } from "react";
import {
  useDebouncedCallback,
  useThrottledCallback,
} from "../../utils/performance/memoization";

// Types for WebSocket optimization
export interface SubscriptionOptions {
  throttle?: number;
  debounce?: number;
  cache?: boolean;
  cacheTTL?: number;
  priority?: "high" | "medium" | "low";
  batchUpdates?: boolean;
}

export interface CachedData<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface SubscriptionManager {
  subscribe: (
    channel: string,
    callback: (data: any) => void,
    options?: SubscriptionOptions
  ) => string;
  unsubscribe: (subscriptionId: string) => void;
  unsubscribeAll: () => void;
  getActiveSubscriptions: () => string[];
  getCachedData: <T>(channel: string) => T | null;
  clearCache: (channel?: string) => void;
}

/**
 * Enhanced subscription manager with optimization features
 */
export class OptimizedSubscriptionManager implements SubscriptionManager {
  private subscriptions = new Map<
    string,
    {
      channel: string;
      callback: (data: any) => void;
      options: SubscriptionOptions;
      lastUpdate: number;
    }
  >();

  private cache = new Map<string, CachedData>();
  private batchQueue = new Map<string, any[]>();
  private batchTimeouts = new Map<string, NodeJS.Timeout>();
  private connectionCallbacks = new Set<() => void>();
  private disconnectionCallbacks = new Set<() => void>();

  constructor(private websocketClient: any) {
    this.setupBatchProcessing();
  }

  /**
   * Subscribe to a WebSocket channel with optimization options
   */
  subscribe(
    channel: string,
    callback: (data: any) => void,
    options: SubscriptionOptions = {}
  ): string {
    const subscriptionId = `${channel}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create optimized callback based on options
    let optimizedCallback = callback;

    if (options.throttle) {
      optimizedCallback = this.createThrottledCallback(
        callback,
        options.throttle
      );
    } else if (options.debounce) {
      optimizedCallback = this.createDebouncedCallback(
        callback,
        options.debounce
      );
    }

    if (options.batchUpdates) {
      optimizedCallback = this.createBatchedCallback(channel, callback);
    }

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      channel,
      callback: optimizedCallback,
      options,
      lastUpdate: 0,
    });

    // Subscribe to WebSocket channel
    this.websocketClient.subscribe(channel, (data: any) => {
      this.handleMessage(subscriptionId, data);
    });

    console.log(`📡 Subscribed to ${channel} with options:`, options);
    return subscriptionId;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.websocketClient.unsubscribe(subscription.channel);
      this.subscriptions.delete(subscriptionId);
      console.log(`📡 Unsubscribed from ${subscription.channel}`);
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    for (const [subscriptionId] of this.subscriptions) {
      this.unsubscribe(subscriptionId);
    }
    this.clearCache();
    console.log("📡 Unsubscribed from all channels");
  }

  /**
   * Get list of active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.values()).map((sub) => sub.channel);
  }

  /**
   * Get cached data for a channel
   */
  getCachedData<T>(channel: string): T | null {
    const cached = this.cache.get(channel);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(channel);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Clear cache for specific channel or all channels
   */
  clearCache(channel?: string): void {
    if (channel) {
      this.cache.delete(channel);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(subscriptionId: string, data: any): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    const { channel, callback, options } = subscription;

    // Cache data if caching is enabled
    if (options.cache) {
      const ttl = options.cacheTTL || 30000; // Default 30 seconds
      this.cache.set(channel, {
        data,
        timestamp: Date.now(),
        ttl,
      });
    }

    // Update last update timestamp
    subscription.lastUpdate = Date.now();

    // Call the optimized callback
    callback(data);
  }

  /**
   * Create throttled callback
   */
  private createThrottledCallback(
    callback: (data: any) => void,
    delay: number
  ) {
    let lastCall = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    return (data: any) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= delay) {
        lastCall = now;
        callback(data);
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          callback(data);
        }, delay - timeSinceLastCall);
      }
    };
  }

  /**
   * Create debounced callback
   */
  private createDebouncedCallback(
    callback: (data: any) => void,
    delay: number
  ) {
    let timeoutId: NodeJS.Timeout | null = null;

    return (data: any) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(data), delay);
    };
  }

  /**
   * Create batched callback
   */
  private createBatchedCallback(
    channel: string,
    callback: (data: any) => void
  ) {
    return (data: any) => {
      if (!this.batchQueue.has(channel)) {
        this.batchQueue.set(channel, []);
      }

      this.batchQueue.get(channel)!.push(data);

      // Clear existing timeout
      const existingTimeout = this.batchTimeouts.get(channel);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout for batch processing
      const timeout = setTimeout(() => {
        const batch = this.batchQueue.get(channel) || [];
        if (batch.length > 0) {
          callback(batch);
          this.batchQueue.delete(channel);
          this.batchTimeouts.delete(channel);
        }
      }, 100); // 100ms batch window

      this.batchTimeouts.set(channel, timeout);
    };
  }

  /**
   * Setup batch processing cleanup
   */
  private setupBatchProcessing(): void {
    // Cleanup batch queues on disconnect
    this.disconnectionCallbacks.add(() => {
      for (const timeout of this.batchTimeouts.values()) {
        clearTimeout(timeout);
      }
      this.batchQueue.clear();
      this.batchTimeouts.clear();
    });
  }

  /**
   * Add connection callback
   */
  onConnect(callback: () => void): void {
    this.connectionCallbacks.add(callback);
  }

  /**
   * Add disconnection callback
   */
  onDisconnect(callback: () => void): void {
    this.disconnectionCallbacks.add(callback);
  }

  /**
   * Get subscription statistics
   */
  getStats(): {
    activeSubscriptions: number;
    cachedChannels: number;
    batchedChannels: number;
    totalMessages: number;
  } {
    return {
      activeSubscriptions: this.subscriptions.size,
      cachedChannels: this.cache.size,
      batchedChannels: this.batchQueue.size,
      totalMessages: Array.from(this.subscriptions.values()).reduce(
        (total, sub) => total + (sub.lastUpdate > 0 ? 1 : 0),
        0
      ),
    };
  }
}

/**
 * Custom hook for optimized WebSocket subscriptions
 */
export const useOptimizedWebSocket = (
  websocketClient: any,
  channel: string,
  options: SubscriptionOptions = {}
) => {
  const subscriptionManagerRef = useRef<OptimizedSubscriptionManager | null>(
    null
  );
  const subscriptionIdRef = useRef<string | null>(null);
  const callbackRef = useRef<((data: any) => void) | null>(null);

  // Initialize subscription manager
  if (!subscriptionManagerRef.current) {
    subscriptionManagerRef.current = new OptimizedSubscriptionManager(
      websocketClient
    );
  }

  const subscribe = useCallback(
    (callback: (data: any) => void) => {
      if (!subscriptionManagerRef.current) return;

      // Unsubscribe from previous subscription
      if (subscriptionIdRef.current) {
        subscriptionManagerRef.current.unsubscribe(subscriptionIdRef.current);
      }

      // Store callback reference
      callbackRef.current = callback;

      // Subscribe with optimizations
      subscriptionIdRef.current = subscriptionManagerRef.current.subscribe(
        channel,
        callback,
        options
      );
    },
    [channel, options]
  );

  const unsubscribe = useCallback(() => {
    if (subscriptionManagerRef.current && subscriptionIdRef.current) {
      subscriptionManagerRef.current.unsubscribe(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
      callbackRef.current = null;
    }
  }, []);

  const getCachedData = useCallback(<T>(): T | null => {
    if (!subscriptionManagerRef.current) return null;
    return subscriptionManagerRef.current.getCachedData<T>(channel);
  }, [channel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    subscribe,
    unsubscribe,
    getCachedData,
    manager: subscriptionManagerRef.current,
  };
};

/**
 * Custom hook for debounced WebSocket updates
 */
export const useDebouncedWebSocket = (
  websocketClient: any,
  channel: string,
  delay: number = 300
) => {
  return useOptimizedWebSocket(websocketClient, channel, {
    debounce: delay,
    cache: true,
    cacheTTL: delay * 2,
  });
};

/**
 * Custom hook for throttled WebSocket updates
 */
export const useThrottledWebSocket = (
  websocketClient: any,
  channel: string,
  delay: number = 1000
) => {
  return useOptimizedWebSocket(websocketClient, channel, {
    throttle: delay,
    cache: true,
    cacheTTL: delay * 2,
  });
};

/**
 * Custom hook for batched WebSocket updates
 */
export const useBatchedWebSocket = (
  websocketClient: any,
  channel: string,
  batchSize: number = 10
) => {
  return useOptimizedWebSocket(websocketClient, channel, {
    batchUpdates: true,
    cache: true,
    cacheTTL: 5000,
  });
};

/**
 * Data caching utilities for WebSocket data
 */
export class WebSocketDataCache {
  private cache = new Map<string, CachedData>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, defaultTTL = 60000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Evict expired entries
    this.evictExpired();

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
    };
  }
}

// Global WebSocket data cache instance
export const globalWebSocketCache = new WebSocketDataCache();
