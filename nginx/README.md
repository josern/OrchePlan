# OrchePlan Nginx VHost Configuration

This is a clean, production-ready virtual host configuration file designed for multi-vhost proxy servers.

## File Structure

```
nginx/
├── orcheplan.conf     # Clean vhost configuration
└── nginx.conf         # Original full configuration (backup)
```

## Installation Instructions

### 1. Copy VHost File
```bash
# Copy to nginx sites-available
sudo cp nginx/orcheplan.conf /etc/nginx/sites-available/

# Create symbolic link to enable
sudo ln -s /etc/nginx/sites-available/orcheplan.conf /etc/nginx/sites-enabled/

# Remove default site if needed
sudo rm /etc/nginx/sites-enabled/default
```

### 2. Update Main Nginx Configuration
Ensure your main `/etc/nginx/nginx.conf` includes:

```nginx
http {
    # Your existing configuration...
    
    # Include all enabled sites
    include /etc/nginx/sites-enabled/*;
}
```

### 3. SSL Certificate Setup
```bash
# Install Let's Encrypt certificates
sudo certbot --nginx -d orcheplan.com -d www.orcheplan.com -d api.orcheplan.com
```

### 4. Test and Reload
```bash
# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Configuration Features

### Clean Architecture
- **api.orcheplan.com** → Backend API (Port 3001)
- **orcheplan.com/www.orcheplan.com** → Frontend App (Port 3000)

### Security Features
- ✅ SSL/TLS with HSTS headers
- ✅ Rate limiting (Auth: 3/min, API: 20/sec, General: 10/sec)
- ✅ Security headers (XSS, CSRF, Frame protection)
- ✅ Sensitive file blocking
- ✅ HTTP to HTTPS redirects

### Performance Optimizations
- ✅ Keepalive connections
- ✅ Load balancing with health checks
- ✅ Static file caching (Next.js assets)
- ✅ Image optimization routing
- ✅ Connection upgrades for WebSockets

### Rate Limiting Zones
- `orcheplan_auth` - 3 requests per minute (login/auth)
- `orcheplan_api` - 20 requests per second (API calls)
- `orcheplan_general` - 10 requests per second (frontend)

## Prerequisites

1. **Application Services Running:**
   - Backend: `http://127.0.0.1:3001`
   - Frontend: `http://127.0.0.1:3000`

2. **DNS Configuration:**
   ```
   orcheplan.com       → Your server IP
   www.orcheplan.com   → Your server IP
   api.orcheplan.com   → Your server IP
   ```

3. **Firewall Configuration:**
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   ```

## Customization

### Changing Ports
Update the upstream servers:
```nginx
upstream orcheplan_backend {
    server 127.0.0.1:YOUR_BACKEND_PORT max_fails=3 fail_timeout=30s;
}

upstream orcheplan_frontend {
    server 127.0.0.1:YOUR_FRONTEND_PORT max_fails=3 fail_timeout=30s;
}
```

### Rate Limiting Adjustment
Modify the rate limiting zones:
```nginx
limit_req_zone $binary_remote_addr zone=orcheplan_api:10m rate=YOUR_RATE;
```

### Adding Additional Domains
Add more server names:
```nginx
server_name orcheplan.com www.orcheplan.com your-additional-domain.com;
```

## Multi-VHost Compatibility

This configuration is designed to work alongside other vhost files:
- Uses unique upstream names (`orcheplan_*`)
- Uses unique rate limiting zones (`orcheplan_*`)
- Self-contained SSL and security configurations
- No conflicts with other applications

## Troubleshooting

### Check Configuration
```bash
sudo nginx -t
```

### View Logs
```bash
# Error logs
sudo tail -f /var/log/nginx/error.log

# Access logs
sudo tail -f /var/log/nginx/access.log
```

### Test Connectivity
```bash
# Test backend
curl http://127.0.0.1:3001/health

# Test frontend
curl http://127.0.0.1:3000
```