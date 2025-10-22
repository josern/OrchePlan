// WebSocket-based real-time client as alternative to SSE
class WebSocketRealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connectionFailed = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private baseUrl: string) {}

  // Connect to WebSocket endpoint
  connect() {
    if (this.connectionFailed) {
      return;
    }

    if (this.socket) {
      this.disconnect();
    }

    try {
      // Convert HTTP(S) URL to WS(S) URL
      const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/realtime/ws';
      
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.connectionFailed = false;
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Send authentication (you might need to send auth token here)
        this.sendMessage({ type: 'auth', token: this.getAuthToken() });
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      };

      this.socket.onclose = () => {
        this.handleDisconnect();
      };

      this.socket.onerror = (error) => {
        console.error('[WS] Connection error:', error);
        this.handleDisconnect();
      };

    } catch (error) {
      console.warn('[WS] Error creating WebSocket:', error);
      this.connectionFailed = true;
      this.emit('connection_failed', { reason: 'creation_error' });
    }
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Send message to server
  private sendMessage(message: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  // Start heartbeat to keep connection alive
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000);
  }

  // Get auth token (implement based on your auth system)
  private getAuthToken() {
    // You might need to get this from cookies or localStorage
    // For cookie-based auth, you might not need to send token explicitly
    return null;
  }

  // Handle incoming messages
  private handleMessage(data: any) {
    
    switch (data.type) {
      case 'connected':
        break;
      case 'pong':
        // Heartbeat response
        break;
      case 'task_update':
        this.emit('task_update', data);
        break;
      case 'project_update':
        this.emit('project_update', data);
        break;
      case 'status_update':
        this.emit('status_update', data);
        break;
      default:
    }
  }

  // Handle disconnection and reconnection logic
  private handleDisconnect() {
    this.isConnected = false;
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectDelay *= 2;
        this.connect();
      }, this.reconnectDelay);
    } else {
      this.connectionFailed = true;
      this.disconnect();
      this.emit('connection_failed', { reason: 'max_attempts_reached' });
    }
  }

  // Add event listener
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  // Remove event listener
  off(event: string, callback: (data: any) => void) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  // Emit event to listeners
  private emit(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WS] Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Check if connected
  getConnectionStatus() {
    return this.isConnected;
  }

  // Check if connection has permanently failed
  hasConnectionFailed() {
    return this.connectionFailed;
  }
}

export default WebSocketRealtimeClient;