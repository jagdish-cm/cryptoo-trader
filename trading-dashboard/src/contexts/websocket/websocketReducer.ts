/**
 * WebSocket state reducer for managing connection state
 */

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastHeartbeat: Date | null;
  subscriptions: string[];
  reconnectAttempts: number;
}

export type WebSocketAction =
  | { type: "CONNECTING" }
  | { type: "CONNECTED"; subscriptions: string[] }
  | { type: "DISCONNECTED"; reason: string }
  | { type: "ERROR"; error: string }
  | { type: "HEARTBEAT" }
  | { type: "SUBSCRIBE"; channel: string }
  | { type: "UNSUBSCRIBE"; channel: string }
  | { type: "RESET_RECONNECT_ATTEMPTS" }
  | { type: "INCREMENT_RECONNECT_ATTEMPTS" };

export const initialWebSocketState: WebSocketState = {
  isConnected: false,
  isConnecting: false,
  error: null,
  lastHeartbeat: null,
  subscriptions: [],
  reconnectAttempts: 0,
};

export function webSocketReducer(
  state: WebSocketState,
  action: WebSocketAction
): WebSocketState {
  switch (action.type) {
    case "CONNECTING":
      return {
        ...state,
        isConnecting: true,
        error: null,
      };

    case "CONNECTED":
      return {
        ...state,
        isConnected: true,
        isConnecting: false,
        error: null,
        subscriptions: action.subscriptions,
        lastHeartbeat: new Date(),
        reconnectAttempts: 0,
      };

    case "DISCONNECTED":
      return {
        ...state,
        isConnected: false,
        isConnecting: false,
        error: action.reason,
        subscriptions: [],
      };

    case "ERROR":
      return {
        ...state,
        isConnecting: false,
        error: action.error,
      };

    case "HEARTBEAT":
      return {
        ...state,
        lastHeartbeat: new Date(),
      };

    case "SUBSCRIBE":
      return {
        ...state,
        subscriptions: [...state.subscriptions, action.channel],
      };

    case "UNSUBSCRIBE":
      return {
        ...state,
        subscriptions: state.subscriptions.filter(
          (sub) => sub !== action.channel
        ),
      };

    case "RESET_RECONNECT_ATTEMPTS":
      return {
        ...state,
        reconnectAttempts: 0,
      };

    case "INCREMENT_RECONNECT_ATTEMPTS":
      return {
        ...state,
        reconnectAttempts: state.reconnectAttempts + 1,
      };

    default:
      return state;
  }
}
