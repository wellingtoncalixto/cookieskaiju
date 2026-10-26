"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const LADO_MAX = 2400;

/** Fotos de celular passam de 4 MB: reduz no aparelho mantendo o texto legível. PDF vai como está. */
async function prepararImagem(arquivo: File): Promise<File> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
  return blob
    ? new File([blob], arquivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })
    : arquivo;
}

function Botao({ pronto }: { pronto: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button className="adm-btn primario" type="submit" disabled={!pronto || pending}>
        {pending ? "Lendo a nota…" : "Ler nota"}
      </button>
      {pending && <span className="adm-mute">Isso leva de 10 a 60 segundos. Não feche a página.</span>}
    </>
  );
}

export function EnviarNota({ acao }: { acao: (form: FormData) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState("");
  const [pronto, setPronto] = useState(false);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    setPronto(false);
    if (!arquivo) return setEstado("");
    if (arquivo.type === "application/pdf") {
      setEstado(
        arquivo.size > 4_000_000
          ? "PDF grande demais (máximo 4 MB)."
          : `PDF pronto (${Math.round(arquivo.size / 1024)} KB).`,
      );
      return setPronto(arquivo.size <= 4_000_000);
    }
    setEstado("Preparando a foto…");
    try {
      const pronta = await prepararImagem(arquivo);
      const dt = new DataTransfer();
      dt.items.add(pronta);
      input.current!.files = dt.files;
      setEstado(`Foto pronta (${Math.round(pronta.size / 1024)} KB).`);
      setPronto(true);
    } catch {
      setEstado("Não foi possível abrir essa imagem.");
    }
  }

  return (
    <form action={acao} className="adm-card">
      <label className="adm-campo">
        <span>Foto ou PDF da nota fiscal / cupom</span>
        <input
          ref={input}
          type="file"
          name="arquivo"
          accept="image/*,application/pdf"
          onChange={escolher}
          required
        />
      </label>
      {estado && <p className="adm-mute">{estado}</p>}
      <div className="adm-acoes" style={{ alignItems: "center" }}>
        <Botao pronto={pronto} />
      </div>
    </form>
  );
}
