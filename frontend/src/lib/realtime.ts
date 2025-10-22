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
      
      // Try EventSource first as it's more stable
      this.connectWithEventSource(url);
      
    } catch (error) {
      console.warn('[SSE] Error creating EventSource - SSE not available:', error);
      this.connectionFailed = true;
      this.emit('connection_failed', { reason: 'creation_error' });
    }
  }

    // Alternative SSE connection using fetch for better compatibility
  private async connectWithFetch(url: string) {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      console.log('[SSE] Attempting fetch-based connection to:', url);
      
      // Set a connection timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        console.warn('[SSE] Fetch connection timeout');
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
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body for SSE stream');
      }

      console.log('[SSE] Successfully connected, processing stream...');
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
      
      console.warn('[SSE] Fetch-based connection failed:', error);
      // Clean up reader if it exists
      if (reader) {
        try {
          reader.releaseLock();
        } catch (releaseError) {
          console.warn('[SSE] Error releasing reader lock:', releaseError);
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
          console.error('[SSE] Stream read error:', readError);
          throw readError;
        }

        const { done, value } = result;
        
        if (done) {
          console.log('[SSE] Stream ended normally');
          this.handleDisconnect();
          break;
        }

        // Safely decode the stream chunk
        let chunk: string;
        try {
          chunk = decoder.decode(value, { stream: true });
        } catch (decodeError) {
          console.error('[SSE] Failed to decode stream chunk:', decodeError);
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
              console.warn('[SSE] Failed to parse message:', trimmedLine, parseError);
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
      console.error('[SSE] Stream processing error:', streamError);
      throw streamError; // Re-throw to be handled by caller
    } finally {
      // Always try to release the reader lock
      try {
        reader.releaseLock();
      } catch (lockError) {
        console.warn('[SSE] Failed to release reader lock:', lockError);
      }
    }
  }

  // Fallback to standard EventSource
  private connectWithEventSource(url: string) {
    try {
      console.log('[SSE] Attempting EventSource connection to:', url);
      
      this.eventSource = new EventSource(url, {
        withCredentials: true
      });

      this.eventSource.onopen = () => {
        console.log('[SSE] EventSource connection established');
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
          console.error('[SSE] Error parsing EventSource message:', error, 'Raw data:', event.data);
        }
      };

      this.eventSource.onerror = (error) => {
        console.warn('[SSE] EventSource error:', error);
        console.log('[SSE] EventSource readyState:', this.eventSource?.readyState);
        
        // If EventSource fails repeatedly, try fetch-based approach
        if (this.reconnectAttempts >= 2) {
          console.log('[SSE] EventSource failing repeatedly, trying fetch-based connection...');
          this.disconnect();
          const url = `${this.baseUrl}/realtime/events`;
          this.connectWithFetch(url);
        } else {
          this.handleDisconnect();
        }
      };

    } catch (error) {
      console.error('[SSE] EventSource creation failed:', error);
      this.connectionFailed = true;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('connection_failed', { reason: 'eventsource_error', error: errorMessage });
    }
  }

  // Handle disconnection and reconnection logic
  private handleDisconnect() {
    const timestamp = new Date().toISOString();
    console.warn(`[SSE] Connection lost at ${timestamp}, attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
    this.isConnected = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(this.reconnectDelay, 30000); // Cap at 30 seconds
      console.log(`[SSE] Reconnecting in ${delay}ms...`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectDelay *= 2;
        console.log('[SSE] Attempting reconnection...');
        this.connect();
      }, delay);
    } else {
      console.error('[SSE] Max reconnection attempts reached, giving up');
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
      lastConnectAttempt: new Date().toISOString()
    };
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
    console.log('[SSE] Manual reconnection requested');
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connectionFailed = false;
    this.connect();
  }
}

export default RealtimeClient;