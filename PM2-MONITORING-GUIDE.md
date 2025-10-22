# PM2 Monitoring Guide

## 🔍 Basic Monitoring Commands

### View Process List
```bash
pm2 list                    # Show all processes
pm2 ls                      # Short alias
pm2 status                  # Same as list
```

### Real-time Monitoring
```bash
pm2 monit                   # Interactive monitoring dashboard
pm2 show <app-name>         # Detailed info for specific app
pm2 show orcheplan-backend  # Backend details
pm2 show orcheplan-frontend # Frontend details
```

### Resource Usage
```bash
pm2 list --watch           # Auto-refresh process list
pm2 prettylist             # Formatted process list
```

## 📈 Real-time Monitoring Dashboard

### PM2 Monit (Built-in)
```bash
pm2 monit
```
Shows:
- CPU usage per process
- Memory usage
- Loop delay
- Active handles
- Real-time logs

### Process Details
```bash
pm2 show orcheplan-backend
```
Displays:
- PID, uptime, restarts
- Memory usage, CPU
- Environment variables
- Process metadata

## 📋 Log Monitoring

### View Logs
```bash
pm2 logs                           # All logs
pm2 logs orcheplan-backend        # Backend logs only
pm2 logs orcheplan-frontend       # Frontend logs only
pm2 logs --lines 50               # Last 50 lines
pm2 logs --follow                 # Follow mode (tail -f)
```

### Log Files (Direct)
```bash
tail -f ./backend/logs/combined.log    # Backend logs
tail -f ./frontend/logs/frontend-combined.log  # Frontend logs
```

## ⚡ Performance Monitoring

### CPU & Memory Usage
```bash
pm2 list                    # Basic stats
htop                        # System-wide monitoring
top -p $(pgrep -d, -f "PM2")  # PM2 processes only
```

### Process Metrics
```bash
pm2 show <id> --watch       # Live process stats
pm2 describe <app-name>      # Detailed description
```

## 🚨 Health Monitoring

### Check Process Health
```bash
pm2 ping                     # PM2 daemon status
pm2 list | grep "online"     # Count online processes
pm2 list | grep "errored"    # Check for errors
```

### Restart Counters
```bash
pm2 list                     # Shows restart count
pm2 reset <app-name>         # Reset restart counter
```

## 📊 Advanced Monitoring

### PM2 Plus (Web Monitoring)
```bash
# Install PM2 Plus for web dashboard
pm2 install pm2-server-monit

# Or use PM2 Plus cloud service
pm2 link <secret> <public>   # Connect to PM2 Plus dashboard
```

### Custom Monitoring Script
```bash
#!/bin/bash
# monitoring-script.sh
echo "=== PM2 Status $(date) ==="
pm2 jlist | jq -r '.[] | "\(.name): \(.pm2_env.status) - CPU: \(.pm2_env.axm_monitor["CPU usage"].value) - MEM: \(.pm2_env.axm_monitor["Memory usage"].value)"'

echo -e "\n=== Resource Usage ==="
pm2 list
```

## 🔧 Automated Monitoring

### Health Check Script
```bash
#!/bin/bash
# health-check.sh
pm2 list | grep -q "errored" && {
    echo "ERROR: Some PM2 processes are errored"
    pm2 restart all
    exit 1
}
echo "All PM2 processes healthy"
```

### Cron Job for Monitoring
```bash
# Add to crontab: crontab -e
*/5 * * * * /path/to/health-check.sh >> /var/log/pm2-health.log 2>&1
```

## 📱 Quick Monitoring Aliases

Add to ~/.bashrc or ~/.zshrc:
```bash
alias pm2s='pm2 list'
alias pm2m='pm2 monit'
alias pm2l='pm2 logs --lines 50'
alias pm2h='pm2 show orcheplan-backend && pm2 show orcheplan-frontend'
```

## 🎯 Essential Monitoring Workflow

### Daily Check
```bash
pm2 list                     # Check process status
pm2 logs --lines 20          # Check recent logs
```

### Performance Check
```bash
pm2 monit                    # Interactive dashboard
# Press 'q' to quit
```

### Troubleshooting
```bash
pm2 show orcheplan-backend   # Detailed process info
pm2 logs orcheplan-backend --lines 100  # Recent logs
pm2 restart orcheplan-backend  # If issues found
```

## 📊 Key Metrics to Watch

- **Status**: Should be "online"
- **Restarts**: Low restart count is good
- **Memory**: Watch for memory leaks
- **CPU**: Should be reasonable %
- **Uptime**: Longer is better
- **Logs**: No error patterns

Use `pm2 monit` for the best real-time overview! 🚀