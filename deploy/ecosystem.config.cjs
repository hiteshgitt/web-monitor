// PM2 process config for the Web Monitor API.
// Start:   pm2 start deploy/ecosystem.config.cjs
// Reload:  pm2 reload deploy/ecosystem.config.cjs --update-env
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'webmonitor-api',
      // server.js loads ./config.env, so it must run from the backend folder
      cwd: path.join(__dirname, '..', 'backend'),
      script: 'server.js',
      // Exactly one instance: the monitoring loop runs inside the API process,
      // so cluster mode would check every site several times per minute.
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      time: true,
    },
  ],
};
