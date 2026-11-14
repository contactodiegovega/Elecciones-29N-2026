import path from "node:path";
import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";

if (process.env.VERCEL || process.env.NETLIFY || process.env.PUBLIC_RELEASE) {
  execFileSync(process.env.PYTHON ?? "python", ["-m", "src.electoral.web_publication", "--release"], {
    cwd: path.join(__dirname, ".."), stdio: "inherit",
  });
}

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  outputFileTracingRoot: path.join(__dirname),
};
export default nextConfig;
