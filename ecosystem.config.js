module.exports = {
  apps: [
    {
      name: 'Infinity Hotel BE',
      script: './dist/main.js',
      autorestart: true,
      watch: false,
      args: '',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT,
        NODE_OPTIONS: '--dns-result-order=ipv4first'
      },
      node_args: '--no-warnings',
    },
  ],
};
