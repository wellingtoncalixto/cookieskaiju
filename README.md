# Cookies Kaiju — site de pedidos

Cardápio digital da Cookies Kaiju (Mogi Mirim/SP) com pedido pelo WhatsApp:
loja → sacola → entrega → dados e pagamento → revisão → mensagem no WhatsApp. Não há pagamento online.

Feito com Next.js 16 (App Router, SSG), TypeScript strict, Tailwind CSS 4, Zustand, Zod e Vitest.

## Rodar no computador

Precisa de Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # já vem com os valores da loja
npm run dev                  # http://localhost:3000
```

Outros comandos:

| Comando             | O que faz                                                      |
| ------------------- | -------------------------------------------------------------- |
| `npm test`          | Roda os testes (agenda, frete, promoção, mensagem e validação) |
| `npm run build`     | Gera a versão de produção                                      |
| `npm start`         | Serve a versão de produção (depois do build)                   |
| `npm run lint`      | ESLint                                                         |
| `npm run format`    | Prettier                                                       |
| `npm run typecheck` | Checagem de tipos                                              |

## Variáveis de ambiente

| Variável                 | Para que serve                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`   | Endereço do site (canonical, sitemap, Open Graph). Ex.: `https://www.cookieskaiju.com.br`                                                                     |
| `NEXT_PUBLIC_WHATSAPP`   | WhatsApp que recebe os pedidos, só números com 55 + DDD                                                                                                       |
| `NEXT_PUBLIC_MODO_TESTE` | `true` libera o próximo fim de semana a qualquer hora (veja abaixo)                                                                                           |
| `LOJA_LAT` / `LOJA_LON`  | **Obrigatórias.** Coordenadas da origem das entregas (CEP 13808-113). Ficam só no servidor e não aparecem no site. Sem elas, a taxa fica sempre "a confirmar" |
| `NOMINATIM_USER_AGENT`   | Identificação exigida pelo OpenStreetMap                                                                                                                      |
| `GOOGLE_MAPS_API_KEY`    | Opcional. Se preenchida, a rota é calculada pela Google Routes API em vez do OpenStreetMap/OSRM                                                               |

As variáveis `NEXT_PUBLIC_*` entram no build: depois de mudar alguma, publique de novo.

## Modo teste

Para testar a opção "o quanto antes" fora do horário de funcionamento:

1. Coloque `NEXT_PUBLIC_MODO_TESTE=true` (no `.env.local` ou nas variáveis da Vercel).
2. Rode o build/publique de novo.

O selo da home passa a mostrar "Modo teste", a loja aparece como aberta (com "o quanto antes" e todas as faixas de horário liberadas), e a mensagem do WhatsApp recebe a linha `_PEDIDO DE TESTE_`.

**Antes de divulgar o site, volte para `false` e publique de novo.**

## Alterar cardápio, preços, horários e frete

Tudo fica em um arquivo: [`src/config/loja.ts`](src/config/loja.ts).

- **Preço:** mude `preco` do sabor.
- **Esgotado:** mude `disponivel` para `false`. O sabor aparece com a etiqueta "Esgotado" e não pode ser adicionado.
- **Novo sabor:** adicione um item em `produtos` e coloque a foto em `public/cookies/{slug}.jpg` (e o cartaz em `public/cookies/posters/{slug}-cartaz.jpg`).
- **Funcionamento e horários:** `agenda` (dias abertos, abertura, fechamento, até que horas aceita "o quanto antes", antecedência mínima e quantos dias aparecem para agendar) e `janelas` (as faixas de 1 hora para agendar). O cliente sempre pode fazer o pedido: fora do horário, ele agenda.
- **Frete:** `frete` (valor base, km incluídos e valor por km).
- **Promoção:** `promo` (data-limite da entrega e quantidade mínima por cidade). Depois da data, a faixa some sozinha.

Cardápio, ficha do produto, sacola, mensagem do WhatsApp, dados estruturados (JSON-LD) e o texto "a partir de R$" leem desse arquivo. Depois de editar, publique de novo.

## Publicar na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Na Vercel, clique em **Add New → Project** e importe o repositório (o framework Next.js é detectado sozinho).
3. Em **Environment Variables**, cadastre as variáveis do `.env.example` com os valores de produção.
4. Clique em **Deploy**.
5. Em **Settings → Domains**, ligue o domínio `www.cookieskaiju.com.br`.

Cada `git push` na branch principal publica uma nova versão. As páginas são estáticas e se atualizam a cada publicação.

## Como a taxa de entrega é calculada

1. O cliente digita o CEP. O navegador busca rua, bairro e cidade no ViaCEP.
2. Com o CEP completo, o servidor (`/api/frete`) localiza o CEP no mapa pela AwesomeAPI de CEP.
3. Se o CEP não tiver coordenada, ou se ela cair fora de `raioMaxKm` da loja (erro da base de CEPs), o servidor tenta pelo nome da rua e do bairro no OpenStreetMap, restrito à região. Quando só acha o bairro, a taxa aparece como aproximada.
4. A rota de carro sai do OSRM (ou da Google Routes API, se `GOOGLE_MAPS_API_KEY` estiver preenchida).
5. Se algo falhar, ou se a rota passar de `rotaMaxKm`, a taxa aparece como "a confirmar" e o pedido segue normalmente. A loja confere pelo link "Rota" da mensagem.

### Se a taxa ficar sempre "a confirmar" em produção

Abra o site, faça uma simulação de pedido e, no navegador, veja a resposta de `/api/frete` (DevTools → Rede), ou veja os logs da função na Vercel. O campo `etapa` diz o que falhou, sem mostrar o endereço:

- `configuração: LOJA_LAT e LOJA_LON não definidas` → cadastre as variáveis na Vercel e publique de novo.
- `HTTP 403` ou `HTTP 429` de algum serviço → o serviço gratuito está recusando o servidor. A solução definitiva é preencher `GOOGLE_MAPS_API_KEY`.

## Privacidade (LGPD)

- Só a sacola (sabores e quantidades) fica salva no navegador, em `localStorage`.
- Nome, endereço e observações ficam só na memória da página e somem ao recarregar ou ao fazer um novo pedido.
- A rota `/api/frete` não grava nem registra endereços. O cache interno guarda só o resultado numérico, indexado por um hash do endereço.
- O site não usa cookies de rastreamento. Se um dia entrar GA4 ou Meta Pixel, será preciso um banner de consentimento antes.

## Checklist fora do código (SEO local)

1. [ ] Criar ou atualizar o **Perfil da Empresa no Google** (Google Business Profile) com o mesmo nome, telefone, área de atendimento, horários e o link do site. Manter **nome, telefone e cidade idênticos** em todos os lugares (consistência NAP).
2. [ ] Cadastrar o domínio no **Google Search Console**, enviar o sitemap (`https://www.cookieskaiju.com.br/sitemap.xml`) e acompanhar a indexação.
3. [ ] Colocar o link do site na bio do Instagram @cookieskaiju e no WhatsApp Business.
4. [ ] Pedir avaliações no Google aos clientes depois da entrega.
5. [ ] Depois de publicar, validar a home e uma página de sabor no [Rich Results Test](https://search.google.com/test/rich-results) e no [Schema Markup Validator](https://validator.schema.org/).
6. [ ] Conferir a prévia dos links no WhatsApp e no Instagram (a imagem de cada sabor é gerada automaticamente).

## Estrutura

```
app/                 rotas (home, /cookies/[slug], checkout, /api/frete, sitemap, robots, manifest)
app/@modal/          ficha do produto aberta como modal (rotas interceptadas)
src/config/loja.ts   configuração única da loja
src/lib/             regras de negócio puras (agenda, frete, mensagem, validação, SEO)
src/store/           sacola (persistida) e pedido (só em memória)
src/components/      componentes da interface
tests/               testes do Vitest
```
