module.exports = {
  apps: [
    {
      name: 'orcheplan-backend',
      script: './backend/dist/server.js',
      cwd: '/opt/orcheplan/current',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/opt/orcheplan/logs/backend-error.log',
      out_file: '/opt/orcheplan/logs/backend-out.log',
      log_file: '/opt/orcheplan/logs/backend-combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'orcheplan-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/opt/orcheplan/current/frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/opt/orcheplan/logs/frontend-error.log',
      out_file: '/opt/orcheplan/logs/frontend-out.log',
      log_file: '/opt/orcheplan/logs/frontend-combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};