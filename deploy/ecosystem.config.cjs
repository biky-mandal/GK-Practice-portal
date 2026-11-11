module.exports = {
  apps: [
    {
      name: 'letscrackadre-api',
      cwd: '/var/www/letscrackadre/server',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' }
    }
  ]
};
