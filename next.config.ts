import type { NextConfig } from "next";

// Set by the GitHub Pages workflow so the app is served correctly from
// https://<user>.github.io/psjgtools/ while local dev keeps root paths.
const isGithubPages = process.env.GITHUB_PAGES === "true";
const repoName = "psjgtools";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGithubPages ? `/${repoName}` : "",
  assetPrefix: isGithubPages ? `/${repoName}/` : "",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
