/** @type {import('next').NextConfig} */
const pages = process.env.NEXT_PUBLIC_LITTLE_HIGGY_PAGES === '1';
const nextConfig = {
  transpilePackages: ['studio'],
  ...(pages ? {
    output: 'export',
    basePath: process.env.LITTLE_HIGGY_BASE_PATH || '/little-higgy',
    trailingSlash: true,
    images: { unoptimized: true },
  } : {}),
};
export default nextConfig;
