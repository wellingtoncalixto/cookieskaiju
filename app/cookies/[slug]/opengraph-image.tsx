import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loja, produtoPorSlug } from "@/config/loja";
import { brl } from "@/lib/formato";

export const alt = "Cookie da Cookies Kaiju";
export const size = { width: 1200, height: 630 };
// JPEG: o PNG passava de 900 KB, e o WhatsApp costuma ignorar prévias acima de ~300 KB.
export const contentType = "image/jpeg";

export function generateStaticParams() {
  return loja.produtos.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = produtoPorSlug(slug) ?? loja.produtos[0];
  const [fonte, foto, logo] = await Promise.all([
    readFile(join(process.cwd(), "assets", "fonts", "LeagueSpartan-800.ttf")),
    readFile(join(process.cwd(), "public", "cookies", `${p.slug}.jpg`)),
    readFile(join(process.cwd(), "public", "brand", "logo-cookies-kaiju.png")),
  ]);
  const src = (b: Buffer, tipo: string) => `data:${tipo};base64,${b.toString("base64")}`;

  const png = new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#111111", color: "#F2EBDD" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 0 56px 64px",
          width: 600,
          fontFamily: "League Spartan",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(logo, "image/png")} width={178} height={161} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, lineHeight: 0.95, textTransform: "uppercase" }}>{p.nome}</div>
          <div style={{ fontSize: 30, color: "#FFB52E", marginTop: 18, textTransform: "uppercase" }}>
            {p.destaque}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 64, color: "#E85D2A", whiteSpace: "nowrap" }}>{brl(p.preco)}</span>
          <span style={{ fontSize: 28, color: "rgba(242,235,221,.7)", whiteSpace: "nowrap" }}>
            {loja.pesoGramas} g · Mogi Mirim/SP
          </span>
        </div>
      </div>
      <div style={{ display: "flex", width: 600, height: 630, position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(foto, "image/jpeg")} width={600} height={630} style={{ objectFit: "cover" }} alt="" />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 160,
            height: 630,
            display: "flex",
            backgroundImage: "linear-gradient(to right, #111111, rgba(17,17,17,0))",
          }}
        />
      </div>
    </div>,
    { ...size, fonts: [{ name: "League Spartan", data: fonte, style: "normal", weight: 800 }] },
  );
  const jpg = await sharp(Buffer.from(await png.arrayBuffer()))
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "Content-Type": contentType } });
}
