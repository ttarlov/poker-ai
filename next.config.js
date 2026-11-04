/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16.4 writes an AGENTS.md into the repo on `next dev`; this repo does not want it.
  agentRules: false,
};
module.exports = nextConfig;
