module.exports = {
  apps: [
    {
      name: 'orcheplan-backend',
      cwd: './backend',
      script: 'dist/src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'orcheplan-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ]
};