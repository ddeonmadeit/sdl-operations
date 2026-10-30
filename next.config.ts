import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg", "bcryptjs", "nodemailer"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    // Site phones lose signal: hold navigations and saves while offline and retry when it's back.
    useOffline: true,
  },
};

export default nextConfig;
