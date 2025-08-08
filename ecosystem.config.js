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
      },
      node_args: '--no-warnings',
    },
  ],
};
