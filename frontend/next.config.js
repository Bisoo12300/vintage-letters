/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Moments is the home tab. Old "/?reply_to=<id>" links open that letter with the reply window.
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'query', key: 'reply_to', value: '(?<id>.+)' }],
        destination: '/letter/:id?reply=1',
        permanent: false,
      },
      { source: '/', destination: '/milestones', permanent: false },
    ];
  },
};

module.exports = nextConfig;
