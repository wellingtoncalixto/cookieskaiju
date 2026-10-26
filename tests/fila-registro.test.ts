import { describe, expect, it } from "vitest";
import {
  FILA_MAX,
  FILA_VALIDADE_MS,
  assinaturaConteudo,
  filaAtualizada,
  filaComItem,
  filaSemItem,
  type EntradaCliente,
} from "@/lib/registro-cliente";

const entrada = (id: string): EntradaCliente => ({
  id,
  modalidade: "entrega",
  horario: "agora",
  itens: [{ slug: "kinder", quantidade: 1 }],
  pagamento: "pix",
  cidade: "Mogi Mirim",
  cep: "13802-067",
});
const T = Date.UTC(2026, 9, 24, 17, 0);

describe("fila de contingência do registro (retenção mínima)", () => {
  it("guarda no máximo 3 resumos, sem repetir o mesmo ID", () => {
    let fila = filaComItem([], entrada("CK-261024-AAAAAAA"), T);
    fila = filaComItem(fila, entrada("CK-261024-AAAAAAA"), T + 1);
    expect(fila).toHaveLength(1);
    for (const s of ["B", "C", "D"]) fila = filaComItem(fila, entrada(`CK-261024-${s.repeat(7)}`), T + 2);
    expect(fila).toHaveLength(FILA_MAX);
    expect(fila.map((i) => i.entrada.id)).not.toContain("CK-261024-AAAAAAA");
  });

  it("descarta resumos com mais de 24h", () => {
    const fila = filaComItem([], entrada("CK-261024-AAAAAAA"), T);
    expect(filaAtualizada(fila, T + FILA_VALIDADE_MS - 1)).toHaveLength(1);
    expect(filaAtualizada(fila, T + FILA_VALIDADE_MS)).toHaveLength(0);
  });

  it("tira da fila quando confirmado", () => {
    const fila = filaComItem([], entrada("CK-261024-AAAAAAA"), T);
    expect(filaSemItem(fila, "CK-261024-AAAAAAA")).toEqual([]);
  });

  it("o resumo não tem campos de dados pessoais", () => {
    const e = entrada("CK-261024-AAAAAAA");
    expect(Object.keys(e).sort()).toEqual([
      "cep",
      "cidade",
      "horario",
      "id",
      "itens",
      "modalidade",
      "pagamento",
    ]);
  });

  it("pedido com o mesmo conteúdo mantém o ID; mudou o conteúdo, muda a assinatura", () => {
    const { id: _id, ...resto } = entrada("CK-261024-AAAAAAA");
    void _id;
    expect(assinaturaConteudo(resto)).toBe(assinaturaConteudo({ ...resto }));
    expect(assinaturaConteudo(resto)).not.toBe(
      assinaturaConteudo({ ...resto, itens: [{ slug: "kinder", quantidade: 2 }] }),
    );
  });
});
