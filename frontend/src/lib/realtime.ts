import { createComponentLogger } from './logger';

// Frontend SSE client for real-time updates
class RealtimeClient {
  private logger = createComponentLogger('RealtimeClient');
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Reduced from 5 to fail faster
  private reconnectDelay = 1000; // Start with 1 second
  private isConnected = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connectionFailed = false;
  private clientId: string | null = null;
  private pendingSubscriptions: Set<string> = new Set();

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
      
      // Try EventSource first as it's more stable
      this.connectWithEventSource(url);
      
    } catch (error) {
      this.logger.error('SSE connection creation failed', {}, error);
      this.connectionFailed = true;
      this.emit('connection_failed', { reason: 'creation_error' });
    }
  }

    // Alternative SSE connection using fetch for better compatibility
  private async connectWithFetch(url: string) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      this.logger.debug('Attempting fetch-based connection', { url });
      
      // Set a connection timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        this.logger.warn('Fetch connection timeout');
        controller.abort();
      }, 30000); // 30 second timeout
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });

      // Clear timeout on successful connection
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.logger.error('SSE authentication failed - user not logged in', {
            status: response.status,
            statusText: response.statusText
          });
          this.connectionFailed = true;
          this.emit('auth_failed', { status: response.status });
          return;
        }
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body for SSE stream');
      }

      this.logger.debug('Fetch connection established, processing stream');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionFailed = false;

      // Use ReadableStream to process SSE data
      reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // Process stream in a separate function to better handle errors
      await this.processSSEStream(reader, decoder, buffer);

    } catch (error) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      this.logger.warn('Fetch-based connection failed', {}, error);
      // Clean up reader if it exists
      if (reader) {
        try {
          reader.releaseLock();
        } catch (releaseError) {
          this.logger.debug('Error releasing reader lock', {}, releaseError);
        }
      }
      
      // If fetch fails, fall back to regular reconnection logic
      this.handleDisconnect();
    }
  }

  // Separate method to handle SSE stream processing
  private async processSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>, 
    decoder: TextDecoder, 
    buffer: string
  ) {
    try {
      while (true) {
        let result;
        try {
          result = await reader.read();
        } catch (readError) {
          this.logger.error('Stream read error', {}, readError);
          throw readError;
        }

        const { done, value } = result;
        
        if (done) {
          this.logger.debug('Stream ended normally');
          this.handleDisconnect();
          break;
        }

        // Safely decode the stream chunk
        let chunk: string;
        try {
          chunk = decoder.decode(value, { stream: true });
        } catch (decodeError) {
          this.logger.error('Failed to decode stream chunk', {}, decodeError);
          continue;
        }

        buffer += chunk;
        
        // Process complete messages (SSE format: "data: {}\n\n")
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Skip empty lines and comments
          if (!trimmedLine || trimmedLine.startsWith(':')) {
            continue;
          }
          
          // Handle SSE data lines
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonData = trimmedLine.slice(6).trim();
              if (jsonData) {
                const data = JSON.parse(jsonData);
                this.handleMessage(data);
              }
            } catch (parseError) {
              this.logger.warn('Failed to parse SSE message', { message: trimmedLine }, parseError);
            }
          }
          // Handle other SSE fields (event, id, retry)
          else if (trimmedLine.includes(': ')) {
            const [field, ...valueParts] = trimmedLine.split(': ');
            const value = valueParts.join(': ');
            
            switch (field) {
              case 'event':
                // Handle event type if needed
                break;
              case 'id':
                // Handle message ID if needed
                break;
              case 'retry':
                // Handle retry interval if needed
                break;
            }
          }
        }
      }
    } catch (streamError) {
      this.logger.error('Stream processing error', {}, streamError);
      throw streamError; // Re-throw to be handled by caller
    } finally {
      // Always try to release the reader lock
      try {
        reader.releaseLock();
      } catch (lockError) {
        this.logger.debug('Failed to release reader lock', {}, lockError);
      }
    }
  }

  // Fallback to standard EventSource
  private connectWithEventSource(url: string) {
    try {
      this.logger.debug('Attempting EventSource connection', { url });
      
      this.eventSource = new EventSource(url, {
        withCredentials: true
      });

      this.eventSource.onopen = () => {
        this.logger.debug('EventSource connection established');
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
          this.logger.error('Error parsing EventSource message', { rawData: event.data }, error);
        }
      };

      this.eventSource.onerror = (error) => {
        const readyState = this.eventSource?.readyState;
        this.logger.warn('EventSource connection error', { readyState });
        
        // EventSource doesn't give us HTTP status codes, but we can infer auth issues
        // If connection immediately closes, it might be auth-related
        if (readyState === EventSource.CLOSED && this.reconnectAttempts === 0) {
          this.logger.error('EventSource connection failed immediately - likely authentication issue');
          this.connectionFailed = true;
          this.emit('auth_failed', { readyState });
          return;
        }
        
        // If EventSource fails repeatedly, try fetch-based approach
        if (this.reconnectAttempts >= 2) {
          this.logger.info('EventSource failing, attempting fetch fallback');
          this.disconnect();
          const url = `${this.baseUrl}/realtime/events`;
          this.connectWithFetch(url);
        } else {
          this.handleDisconnect();
        }
      };

    } catch (error) {
      this.logger.error('EventSource creation failed', {}, error);
      this.connectionFailed = true;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('connection_failed', { reason: 'eventsource_error', error: errorMessage });
    }
  }

  // Handle disconnection and reconnection logic
  private handleDisconnect() {
    this.logger.warn('Connection lost, attempting reconnection', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.maxReconnectAttempts
    });
    this.isConnected = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(this.reconnectDelay, 30000); // Cap at 30 seconds
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectDelay *= 2;
        this.logger.debug('Attempting reconnection', { attempt: this.reconnectAttempts });
        this.connect();
      }, delay);
    } else {
      this.logger.error('Max reconnection attempts reached, connection failed permanently');
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
        // capture assigned clientId from server welcome message
        try {
          if (data.clientId) {
            this.clientId = data.clientId;
            // flush any pending subscriptions
            if (this.pendingSubscriptions.size > 0) {
              this.pendingSubscriptions.forEach(pid => {
                // fire and forget
                this.subscribe(pid).catch(() => {});
              });
              this.pendingSubscriptions.clear();
            }
          }
        } catch (e) {
          this.logger.debug('Failed to process connected payload', {}, e);
        }
  this.emit('connected', data);
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
          this.logger.error('Error in event listener', { event }, error);
        }
      });
    }
  }

  // Subscribe to a project channel - tells backend to add this client to project listeners
  async subscribe(projectId: string) {
    if (!projectId) return false;
    if (!this.clientId) {
      // queue until clientId is available
      this.pendingSubscriptions.add(projectId);
      return true;
    }

    try {
      const url = `${this.baseUrl}/realtime/subscribe`;
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: this.clientId, projectId })
      });
      if (!resp.ok) {
        this.logger.warn('Failed to subscribe to project', { projectId, status: resp.status });
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Error subscribing to project', { projectId }, error);
      return false;
    }
  }

  // Unsubscribe from a project channel
  async unsubscribe(projectId: string) {
    if (!projectId) return false;
    if (!this.clientId) {
      this.pendingSubscriptions.delete(projectId);
      return true;
    }

    try {
      const url = `${this.baseUrl}/realtime/unsubscribe`;
      const resp = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: this.clientId, projectId })
      });
      if (!resp.ok) {
        this.logger.warn('Failed to unsubscribe from project', { projectId, status: resp.status });
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('Error unsubscribing from project', { projectId }, error);
      return false;
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

  // Get detailed connection information for debugging
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      connectionFailed: this.connectionFailed,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      reconnectDelay: this.reconnectDelay,
      eventSourceState: this.eventSource?.readyState,
      eventSourceStateText: this.eventSource ? this.getEventSourceStateText(this.eventSource.readyState) : 'N/A',
      lastConnectAttempt: new Date().toISOString(),
      clientCount: this.listeners.size,
      listenedEvents: Array.from(this.listeners.keys())
    };
  }

  // Add debugging info to window for production troubleshooting
  enableProductionDebug() {
    (window as any).sseDebug = {
      getInfo: () => this.getConnectionInfo(),
      forceReconnect: () => this.forceReconnect(),
      testMessage: (data: any) => this.handleMessage(data),
      getStats: () => ({
        totalListeners: this.listeners.size,
        eventTypes: Array.from(this.listeners.keys()),
        listenerCounts: Array.from(this.listeners.entries()).map(([event, listeners]) => ({
          event,
          count: listeners.size
        }))
      })
    };
    
    // Add production-safe event logging
    const originalHandleMessage = this.handleMessage.bind(this);
    this.handleMessage = (data: any) => {
      (window as any).lastSSEMessage = {
        timestamp: new Date().toISOString(),
        type: data.type,
        action: data.action,
        hasData: !!data.data
      };
      return originalHandleMessage(data);
    };
    
    return 'SSE Debug enabled. Use window.sseDebug.getInfo() to check status';
  }

  private getEventSourceStateText(state: number): string {
    switch (state) {
      case EventSource.CONNECTING: return 'CONNECTING';
      case EventSource.OPEN: return 'OPEN';
      case EventSource.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  // Manual reconnection method for debugging
  forceReconnect() {
    this.logger.info('Manual reconnection requested');
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connectionFailed = false;
    this.connect();
  }
}

export default RealtimeClient;