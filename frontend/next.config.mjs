/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // Proxy de /api/* al backend. El WebSocket NO pasa por acá: el navegador se
    // conecta directo a NEXT_PUBLIC_WS_URL (o al mismo host detrás de un proxy).
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:8001';
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
