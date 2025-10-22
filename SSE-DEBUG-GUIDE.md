# SSE Production Debugging Guide

## 🔍 Browser Console Commands (Production)

After the app loads, use these commands in the browser console:

### Check SSE Connection Status
```javascript
// Basic connection info
window.sseDebug.getInfo()

// Detailed statistics
window.sseDebug.getStats()

// Last received SSE message
window.lastSSEMessage
```

### Force Reconnection
```javascript
window.sseDebug.forceReconnect()
```

### Test Message Processing
```javascript
// Test if message handling works
window.sseDebug.testMessage({
  type: 'task_update',
  action: 'updated',
  data: { id: 'test', title: 'Test Task' }
})
```

## 🌐 Backend API Debugging

### Check SSE Health
```bash
curl https://api.orcheplan.com/realtime/health
```

### Test SSE Endpoint Access
```bash
curl https://api.orcheplan.com/realtime/test
```

### Test SSE Connection
```bash
curl -N -H "Accept: text/event-stream" \
     -H "Cache-Control: no-cache" \
     --cookie-jar cookies.txt \
     https://api.orcheplan.com/realtime/events
```

## 🔧 Network Tab Debugging

1. **Open Browser DevTools → Network tab**
2. **Look for `/realtime/events` request**
3. **Check the response:**
   - Status should be `200`
   - Content-Type should be `text/event-stream`
   - Connection should stay open
   - Should see data messages flowing

## 📊 Common Issues & Solutions

### Issue: No SSE connection
```javascript
// Check in console:
window.sseDebug.getInfo()
// Look for: isConnected: false, connectionFailed: true
```

**Solutions:**
- Check network connectivity
- Verify authentication cookies
- Check CORS configuration

### Issue: Connection established but no messages
```javascript
// Check if messages are being received:
window.lastSSEMessage
// Should update when tasks change
```

**Solutions:**
- Verify user has access to projects
- Check backend logs for broadcast errors
- Test with manual task update

### Issue: Messages received but UI not updating
```javascript
// Check event listeners:
window.sseDebug.getStats()
// Should show task_update listeners
```

**Solutions:**
- Check React state updates in Components tab
- Verify task normalization logic
- Check for JavaScript errors

## 🔬 Step-by-Step Debugging

### 1. Verify SSE Connection
```javascript
const info = window.sseDebug.getInfo();
console.log('SSE Status:', info.isConnected ? 'Connected' : 'Disconnected');
console.log('Event Source State:', info.eventSourceStateText);
```

### 2. Check Message Reception
```javascript
// This should update when you receive messages
console.log('Last message:', window.lastSSEMessage);
```

### 3. Test Manual Reconnection
```javascript
window.sseDebug.forceReconnect();
// Wait a few seconds, then check:
window.sseDebug.getInfo()
```

### 4. Verify Backend Stats
```bash
curl https://api.orcheplan.com/realtime/health
```

### 5. Test Task Update Flow
1. Create/update a task in the UI
2. Check browser console for SSE message:
```javascript
window.lastSSEMessage
```
3. Should show: `type: "task_update", action: "updated"`

## 🚨 Production Logging

The SSE client now logs important events even in production:
- Connection failures
- Parse errors
- Reconnection attempts

Check browser console for any error messages with structured data.

## 🔄 Manual Testing

If SSE seems broken, test the full flow:

1. **Backend Health**: `curl https://api.orcheplan.com/realtime/health`
2. **Frontend Connection**: `window.sseDebug.getInfo()`
3. **Message Flow**: Create a task and check `window.lastSSEMessage`
4. **Event Listeners**: `window.sseDebug.getStats()`

## 📝 Collecting Debug Info

For support, collect this info:

```javascript
// Copy this output:
JSON.stringify({
  sseInfo: window.sseDebug.getInfo(),
  sseStats: window.sseDebug.getStats(),
  lastMessage: window.lastSSEMessage,
  userAgent: navigator.userAgent,
  url: window.location.href,
  timestamp: new Date().toISOString()
}, null, 2)
```

This comprehensive debugging setup will help you identify exactly what's happening with SSE in production! 🎯