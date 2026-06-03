/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
  outputFileTracingIncludes: {
    // Copies engine files into the traced output for all routes
    "/**": ["./lib/generated/prisma/**"],
  },
};

module.exports = nextConfig;
