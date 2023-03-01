const repo = "smplr";
const isDeploy = process.env.DEPLOY || false;

let assetPrefix = "/";
let basePath = "";

if (isDeploy) {
  assetPrefix = `/${repo}/`;
  basePath = `/${repo}`;
}
/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix,
  basePath,
  reactStrictMode: true,
};

module.exports = nextConfig;
