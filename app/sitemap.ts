import type { MetadataRoute } from "next";

// One public page; rooms are private and deliberately not listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://agilepoker.dev/", changeFrequency: "monthly", priority: 1 }];
}
