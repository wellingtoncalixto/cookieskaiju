import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O site é 100% estático (SSG). Sem cacheComponents/partialPrefetching, as páginas de sabor
  // usam o modelo clássico generateStaticParams + generateMetadata, prerenderizadas no build.
  cacheComponents: false,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Fotos dos sabores enviadas pelo admin (Vercel Blob).
    remotePatterns: [new URL("https://*.public.blob.vercel-storage.com/**")],
    qualities: [75, 85],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/(sacola|pedido)(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/referencia-index.html", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  experimental: {
    // Fotos do admin chegam já reduzidas no navegador (até ~1 MB); folga para o formulário.
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
