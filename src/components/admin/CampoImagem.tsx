"use client";

import { useRef, useState } from "react";

const LADO_MAX = 1600;

/** Reduz a foto no próprio aparelho (até 1600 px, JPEG) antes de enviar: fotos de celular passam de 5 MB. */
async function reduzir(arquivo: File): Promise<File> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) return arquivo;
  return new File([blob], arquivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function CampoImagem({ nome, rotulo, atual }: { nome: string; rotulo: string; atual: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | null>(atual);
  const [estado, setEstado] = useState("");

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEstado("Preparando a foto…");
    try {
      const reduzida = await reduzir(arquivo);
      const dt = new DataTransfer();
      dt.items.add(reduzida);
      input.current!.files = dt.files;
      setPrevia(URL.createObjectURL(reduzida));
      setEstado(`Pronta para enviar (${Math.round(reduzida.size / 1024)} KB).`);
    } catch {
      setEstado("Não foi possível ler essa imagem.");
    }
  }

  return (
    <label className="adm-campo">
      <span>{rotulo}</span>
      {previa && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previa} alt="" className="adm-foto" style={{ width: 96, height: 96 }} />
      )}
      <input ref={input} type="file" name={nome} accept="image/*" onChange={escolher} />
      {estado && <span className="adm-mute">{estado}</span>}
    </label>
  );
}
