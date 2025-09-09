/**
 * WebSocket subscription management utilities
 */

import { WebSocketClient } from "./WebSocketClient";

export interface SubscriptionConfig {
  channel: string;
  params?: Record<string, unknown>;
  essential?: boolean; // Whether this subscription is critical for app functionality
}

export class WebSocketSubscriptionManager {
  private client: WebSocketClient;
  private subscriptions = new Map<string, SubscriptionConfig>();
  private activeSubscriptions = new Set<string>();

  constructor(client: WebSocketClient) {
    this.client = client;
  }

  /**
   * Registers a subscription configuration
   */
  register(config: SubscriptionConfig): void {
    this.subscriptions.set(config.channel, config);
  }

  /**
   * Subscribes to a channel
   */
  subscribe(channel: string): boolean {
    const config = this.subscriptions.get(channel);
    if (!config) {
      console.warn(`Subscription config not found for channel: ${channel}`);
      return false;
    }

    if (this.activeSubscriptions.has(channel)) {
      console.log(`Already subscribed to channel: ${channel}`);
      return true;
    }

    try {
      this.client.subscribe(channel);
      this.activeSubscriptions.add(channel);
      console.log(`Subscribed to channel: ${channel}`);
      return true;
    } catch (error) {
      console.error(`Failed to subscribe to channel ${channel}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribes from a channel
   */
  unsubscribe(channel: string): boolean {
    if (!this.activeSubscriptions.has(channel)) {
      console.log(`Not subscribed to channel: ${channel}`);
      return true;
    }

    try {
      this.client.unsubscribe(channel);
      this.activeSubscriptions.delete(channel);
      console.log(`Unsubscribed from channel: ${channel}`);
      return true;
    } catch (error) {
      console.error(`Failed to unsubscribe from channel ${channel}:`, error);
      return false;
    }
  }

  /**
   * Subscribes to all essential channels
   */
  subscribeToEssentialChannels(): void {
    const essentialChannels = Array.from(this.subscriptions.values())
      .filter((config) => config.essential)
      .map((config) => config.channel);

    essentialChannels.forEach((channel) => {
      this.subscribe(channel);
    });
  }

  /**
   * Resubscribes to all previously active channels (useful after reconnection)
   */
  resubscribeAll(): void {
    const channelsToResubscribe = Array.from(this.activeSubscriptions);
    this.activeSubscriptions.clear();

    channelsToResubscribe.forEach((channel) => {
      this.subscribe(channel);
    });
  }

  /**
   * Unsubscribes from all channels
   */
  unsubscribeAll(): void {
    const channelsToUnsubscribe = Array.from(this.activeSubscriptions);

    channelsToUnsubscribe.forEach((channel) => {
      this.unsubscribe(channel);
    });
  }

  /**
   * Gets list of active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions);
  }

  /**
   * Gets list of registered subscription configs
   */
  getRegisteredSubscriptions(): SubscriptionConfig[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Checks if subscribed to a channel
   */
  isSubscribed(channel: string): boolean {
    return this.activeSubscriptions.has(channel);
  }

  /**
   * Gets subscription status summary
   */
  getSubscriptionStatus(): {
    total: number;
    active: number;
    essential: number;
    essentialActive: number;
  } {
    const total = this.subscriptions.size;
    const active = this.activeSubscriptions.size;

    const essentialConfigs = Array.from(this.subscriptions.values()).filter(
      (config) => config.essential
    );
    const essential = essentialConfigs.length;

    const essentialActive = essentialConfigs.filter((config) =>
      this.activeSubscriptions.has(config.channel)
    ).length;

    return {
      total,
      active,
      essential,
      essentialActive,
    };
  }
}

/**
 * Default subscription configurations for the trading application
 */
export const createDefaultSubscriptions = (): SubscriptionConfig[] => [
  {
    channel: "system_status",
    essential: true,
  },
  {
    channel: "portfolio_updates",
    essential: true,
  },
  {
    channel: "market_data",
    essential: true,
    params: {
      symbols: ["BTC/USDT", "ETH/USDT"],
    },
  },
  {
    channel: "trading_signals",
    essential: true,
  },
  {
    channel: "ai_decisions",
    essential: true,
  },
  {
    channel: "position_updates",
    essential: false,
  },
  {
    channel: "trade_executions",
    essential: false,
  },
  {
    channel: "regime_changes",
    essential: false,
  },
];

/**
 * Creates and configures a subscription manager with default subscriptions
 */
export const createSubscriptionManager = (
  client: WebSocketClient
): WebSocketSubscriptionManager => {
  const manager = new WebSocketSubscriptionManager(client);

  // Register default subscriptions
  const defaultSubscriptions = createDefaultSubscriptions();
  defaultSubscriptions.forEach((config) => {
    manager.register(config);
  });

  return manager;
};
