// Frontend SSE client for real-time updates
class RealtimeClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Reduced from 5 to fail faster
  private reconnectDelay = 1000; // Start with 1 second
  private isConnected = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connectionFailed = false;

  constructor(private baseUrl: string) {}

  // Connect to SSE endpoint
  connect() {
    // If connection has failed before, don't try again
    if (this.connectionFailed) {
      return;
    }

    if (this.eventSource) {
      this.disconnect();
    }

    try {
      const url = `${this.baseUrl}/realtime/events`;
      
      // Try fetch-based approach first for better error handling
      this.connectWithFetch(url);
      
    } catch (error) {
      console.warn('[SSE] Error creating EventSource - SSE not available:', error);
      this.connectionFailed = true;
      this.emit('connection_failed', { reason: 'creation_error' });
    }
  }

  // Alternative SSE connection using fetch for better compatibility
  private async connectWithFetch(url: string) {
    try {
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body for SSE stream');
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionFailed = false;

      // Use ReadableStream to process SSE data
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              this.handleDisconnect();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            // Process complete messages
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  this.handleMessage(data);
                } catch (error) {
                  console.error('[SSE] Error parsing message:', error);
                }
              }
            }
          }
        } catch (error) {
          console.error('[SSE] Stream processing error:', error);
          this.handleDisconnect();
        }
      };

      processStream();

    } catch (error) {
      console.warn('[SSE] Fetch-based connection failed, trying EventSource...', error);
      this.connectWithEventSource(url);
    }
  }

  // Fallback to standard EventSource
  private connectWithEventSource(url: string) {
    try {
      this.eventSource = new EventSource(url, {
        withCredentials: true
      });

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.connectionFailed = false;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[SSE] Error parsing EventSource message:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.warn('[SSE] EventSource error:', error);
        this.handleDisconnect();
      };

    } catch (error) {
      console.error('[SSE] EventSource creation failed:', error);
      this.connectionFailed = true;
      this.emit('connection_failed', { reason: 'eventsource_error' });
    }
  }

  // Handle disconnection and reconnection logic
  private handleDisconnect() {
    console.warn('[SSE] Connection lost');
    this.isConnected = false;
    
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

  // Disconnect from SSE
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }

  // Handle incoming messages
  private handleMessage(data: any) {
    
    switch (data.type) {
      case 'connected':
        break;
      case 'heartbeat':
        // Silent heartbeat to keep connection alive
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
          console.error(`[SSE] Error in event listener for ${event}:`, error);
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

export default RealtimeClient;