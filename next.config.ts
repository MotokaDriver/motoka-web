import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/motoka-web' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/motoka-web/' : '',
  images: {
    unoptimized: true,
  }
};

export default nextConfig;
