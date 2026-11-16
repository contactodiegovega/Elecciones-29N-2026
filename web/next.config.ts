import path from "node:path";
import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";

if (process.env.VERCEL || process.env.NETLIFY || process.env.PUBLIC_RELEASE) {
  execFileSync(process.execPath, [path.join(__dirname, "scripts/check-data.cjs"), "--release"], {
    cwd: __dirname, stdio: "inherit",
  });
}

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(__dirname),
};
export default nextConfig;
