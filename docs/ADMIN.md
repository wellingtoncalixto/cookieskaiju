# Admin, banco de dados e ChatGPT

O `/admin` substitui o Painel Comercial e a planilha de precificação:

- **Operação**: abre e fecha o delivery e mostra os pedidos de hoje e os agendados (código, itens, hora em que
  foi feito, cookies, entrega e total), com botões de status (concluído, cancelado, abandonado).
- **Produtos**: cardápio do site (nome, preço de venda, foto, esgotado, ativo, ordem). O site lê daqui.
- **Precificação**: insumos, receitas (a massa é uma receita "base" usada pelos sabores) e forno elétrico.
  Qualquer mudança recalcula o custo, o lucro e a margem de todos os sabores.

Nada de dados pessoais vai para o banco: nem nome, nem telefone, nem endereço.

## 1. Criar os serviços na Vercel (uma vez)

Em **Vercel → projeto cookieskaiju → Storage**:

1. **Create Database → Neon** · região **São Paulo (sa-east-1)** · conecte ao projeto marcando
   **Production** e **Preview**. Ative a opção de criar um **branch de banco para cada Preview**.
   Isso cria a variável `DATABASE_URL`.
2. **Create → Blob** · conecte ao projeto. Isso cria `BLOB_READ_WRITE_TOKEN`.

Em **Settings → Functions**, escolha a região **São Paulo (gru1)**, perto do banco.

## 2. Variáveis de ambiente

Em **Settings → Environment Variables** (Production e Preview), além das que a Vercel criou:

| Variável                       | Valor                                                  |
| ------------------------------ | ------------------------------------------------------ |
| `NEXT_PUBLIC_REGISTRO_PEDIDOS` | `true`                                                 |
| `FRETE_COTACAO_SEGREDO`        | texto aleatório (32+ caracteres)                       |
| `ADMIN_SENHA`                  | a senha do admin                                       |
| `ADMIN_SEGREDO_SESSAO`         | texto aleatório (32+ caracteres), diferente dos outros |
| `GPT_API_CHAVE`                | texto aleatório (32+ caracteres), para o ChatGPT       |
| `DATABASE_URL_LEITURA`         | ver o passo 5                                          |

Para gerar um texto aleatório: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## 3. Criar as tabelas e carregar os dados

No computador, com a `DATABASE_URL` do Neon (Neon → **Connection string**):

```bash
DATABASE_URL="postgresql://..." npm run db:migrar db/dados-iniciais.local.sql
```

- `db/migracoes/` cria as tabelas e as views do painel (pode rodar de novo: só aplica o que falta).
- `db/dados-iniciais.local.sql` traz insumos, receitas, produtos, configuração, metas e os 8 pedidos
  históricos. **Esse arquivo não vai para o GitHub** (o repositório é público e ele tem receitas e custos).

Para um Preview, rode o mesmo comando com a `DATABASE_URL` do branch do Preview.

## 4. Publicar

Depois de um deploy com as variáveis acima, abra `/admin`, entre com a senha e confira:

1. **Produtos** mostra os 4 sabores, com custo e margem.
2. **Operação**: toque em **Fechado** e veja o site avisar "Fechado agora" em até 1 minuto; volte para
   **Automático**.
3. Faça um pedido de teste no site e veja o pedido aparecer na Operação (atualiza sozinha a cada minuto).

Sem `DATABASE_URL`, o site continua funcionando com o cardápio de `src/config/loja.ts` e o admin avisa que o
banco não está configurado.

## 5. ChatGPT (somente leitura)

**a) Usuário só de leitura no banco.** No Neon → **SQL Editor** (troque a senha):

```sql
create role gpt_leitura with login password 'TROQUE-POR-UMA-SENHA-FORTE';
grant usage on schema public to gpt_leitura;
grant select on all tables in schema public to gpt_leitura;
alter default privileges in schema public grant select on tables to gpt_leitura;
alter role gpt_leitura set statement_timeout = '10s';
```

Monte a `DATABASE_URL_LEITURA` com a mesma URL do banco, trocando usuário e senha por `gpt_leitura` e a
senha acima, e cadastre na Vercel.

**b) GPT personalizado.** Em chatgpt.com → **Explorar GPTs → Criar → Configurar → Ações → Criar nova ação**:

1. **Importar de URL**: `https://www.cookieskaiju.com.br/api/gpt/openapi.json`
2. **Autenticação**: Chave de API · tipo **Bearer** · cole a `GPT_API_CHAVE`.
3. Nas instruções do GPT, algo como: "Você analisa os dados da Cookies Kaiju. Antes de consultar, chame
   `lerEsquema`. Use `consultar` com SQL do PostgreSQL. Considere só pedidos com status 'concluido' para
   vendas, salvo pedido contrário. Valores em reais."

O ChatGPT só consegue ler: o usuário do banco não tem permissão de escrita, cada consulta roda numa transação
somente leitura e cada resposta tem no máximo 500 linhas.

## Rodar o admin no computador

```bash
DATABASE_URL=pglite:.dados/dev NEXT_PUBLIC_REGISTRO_PEDIDOS=true ADMIN_SENHA=teste \
ADMIN_SEGREDO_SESSAO=um-segredo-qualquer-com-32-caracteres npm run dev
```

O banco embutido (PGlite) fica em `.dados/` (fora do git) e recebe as migrações e o
`db/dados-iniciais.local.sql` na primeira vez. Abrir/fechar e fotos precisam dos serviços da Vercel.

## Onde fica cada coisa

| O quê                                                          | Onde                        |
| -------------------------------------------------------------- | --------------------------- |
| Tabelas e views                                                | `db/migracoes/`             |
| Cálculo de custo das receitas                                  | `src/lib/precificacao.ts`   |
| Valores do pedido (embalagem, taxa, combustível, contribuição) | `src/lib/valores-pedido.ts` |
| Acesso ao banco                                                | `src/server/`               |
| Telas e ações do admin                                         | `app/admin/`                |
| API do ChatGPT                                                 | `app/api/gpt/`              |
