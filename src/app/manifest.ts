import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tailhelm",
    short_name: "Tailhelm",
    description: "The care log for dogs with lifelong conditions",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ec",
    theme_color: "#1f4d3a",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
