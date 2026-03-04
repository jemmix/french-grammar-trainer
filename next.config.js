/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  // Exclude better-sqlite3 (native dep) from serverless functions in production.
  // In prod the S3 store is used instead; SQLite is dev-only.
  serverExternalPackages: ["better-sqlite3"],
};

export default config;
