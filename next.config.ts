import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["proj4", "itm-wgs84"],
};

export default nextConfig;
