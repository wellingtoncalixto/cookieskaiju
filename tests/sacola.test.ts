import { describe, expect, it } from "vitest";
import { sacolaExpirada } from "@/lib/tempo";

const H = 3600_000;

describe("validade da sacola (24h sem voltar ao site)", () => {
  const agora = Date.UTC(2026, 9, 18, 15, 0);

  it("continua valendo antes de 24h", () => {
    expect(sacolaExpirada(agora - 23 * H, agora, 24)).toBe(false);
    expect(sacolaExpirada(agora - 24 * H, agora, 24)).toBe(false);
  });

  it("expira depois de 24h", () => {
    expect(sacolaExpirada(agora - 24 * H - 1, agora, 24)).toBe(true);
    expect(sacolaExpirada(agora - 3 * 24 * H, agora, 24)).toBe(true);
  });
});
