import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* Production-optimized configuration */
  
  // Development origins (only used in development)
  allowedDevOrigins: [
    'http://localhost:9002',
    'http://127.0.0.1:9002',
    'https://9002--main--orcheplan--andreas.coder.josern.com',
    'http://172.17.0.2:9002',
    '9002--main--orcheplan--andreas.coder.josern.com'
  ],
  
  // Production optimizations
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  compress: true,
  poweredByHeader: false,
  
  // Build configuration
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 60,
    formats: ['image/webp'],
    dangerouslyAllowSVG: false,
  },
  
  // Security headers
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
  
  // Experimental features for production
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
