/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@nexora/ui", "@nexora/types", "@nexora/validation", "@nexora/api-client"],
};

export default nextConfig;
