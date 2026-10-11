import type { MetadataRoute } from "next";
import { HOME_PATH } from "@/lib/auth/input";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: HOME_PATH,
    name: "Tailhelm",
    short_name: "Tailhelm",
    description: "The care log for dogs with lifelong conditions",
    // Opens on Today; the proxy sends anyone signed out to sign-in first.
    start_url: HOME_PATH,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f3ec",
    theme_color: "#1f4d3a",
    lang: "en-GB",
    // Placeholder icons until the brand mark is designed.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
