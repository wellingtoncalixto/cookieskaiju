import "server-only";
import { unstable_cache } from "next/cache";
import { loja, type Produto } from "@/config/loja";
import { bancoConfigurado, obterBanco } from "@/server/db";

/** Tag do cache do cardápio: o admin chama revalidateTag(TAG_CATALOGO) a cada mudança. */
export const TAG_CATALOGO = "catalogo";

const lerDoBanco = unstable_cache(
  async (): Promise<Produto[]> =>
    obterBanco().consulta<Produto>(
      `select slug, nome, destaque, descricao, alt, preco::float8 as preco, disponivel, foto_url as foto,
              cartaz_url as cartaz
         from produtos where ativo order by ordem, id`,
    ),
  ["catalogo-v1"],
  { tags: [TAG_CATALOGO] },
);

/** Cardápio do site: do banco, ou `loja.produtos` se o banco não estiver configurado ou falhar. */
export async function obterCatalogo(): Promise<Produto[]> {
  if (!bancoConfigurado()) return loja.produtos;
  try {
    return await lerDoBanco();
  } catch (erro) {
    console.error("catalogo: falha ao ler o banco —", erro instanceof Error ? erro.message : erro);
    return loja.produtos;
  }
}
