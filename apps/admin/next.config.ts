import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Repo root is one level above apps/, not this app's own directory —
  // pins Turbopack's workspace-root inference to the monorepo root.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
