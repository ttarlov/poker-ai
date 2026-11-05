import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/session/", "/api/"] },
    sitemap: "https://agilepoker.dev/sitemap.xml",
    host: "https://agilepoker.dev",
  };
}
