# Registro automático de pedidos no Painel Comercial

Este guia é para você instalar e ativar a integração **na sua própria conta Google e na sua Vercel**.
Nenhuma credencial passa por terceiros: você gera os segredos, cadastra e guarda.

## Como funciona

```
Navegador ──POST /api/pedidos──▶ Next.js (Vercel) ──POST assinado (HMAC)──▶ Apps Script ──▶ Planilha
   │                               valida e recalcula                          trava, evita duplicado,
   └── abre o WhatsApp na hora      sabores e frete                            grava Itens e Pedidos
```

- O cliente toca em "Enviar pedido pelo WhatsApp". O WhatsApp abre na hora, e o registro segue em segundo plano.
- O pedido ganha um código `CK-AAMMDD-XXXXXXX` (ex.: `CK-261024-7K3QF9A`), que aparece na comanda e na mensagem.
- **Não são registrados:** nome, telefone, endereço nem o texto da mensagem.
- **São registrados:** código, data e hora (do servidor), sabores e quantidades, Entrega ou Retirada, cidade, distância, frete e forma de pagamento.
- Todo pedido entra como **Pendente**. A troca para Concluído, Cancelado ou Abandonado é sempre manual, na planilha.

### O que é gravado em cada coluna

**Pedidos**: escreve só A–G e N–S. **H–M (fórmulas) nunca são escritas.**

| Coluna                | Valor                                                                |
| --------------------- | -------------------------------------------------------------------- |
| A Data                | data do registro (São Paulo)                                         |
| B ID pedido           | `CK-...`                                                             |
| C Cidade              | cidade da entrega (vazia na retirada)                                |
| D Distância ida km    | km da rota; **0** na retirada; vazia se a taxa ficou "a confirmar"   |
| E Pagamento           | `Pix`, `InfiniteTap crédito`, `InfiniteTap débito` ou `Dinheiro`     |
| F Status              | `Pendente`                                                           |
| G Frete cobrado R$    | valor; **0** na retirada ou com frete grátis; vazio se "a confirmar" |
| N Origem marketing    | `site`                                                               |
| O Tipo de atendimento | `Entrega` ou `Retirada`                                              |
| P, Q                  | vazias (o site não pergunta)                                         |
| R Hora do pedido      | `HH:mm`                                                              |
| S Tipo de registro    | `Site automático`                                                    |

**Itens**: escreve só A–C (ID, produto, quantidade), uma linha por sabor. **D–G nunca são escritas.**

Os textos de pagamento, status e atendimento ficam em `src/config/planilha.ts`. Se algum nome de produto
for diferente na aba Produtos, ajuste `nomeProduto` nesse arquivo.

> ⚠️ **Confira antes de ativar:** `Dinheiro` não está na lista de pagamentos que você disse que as fórmulas
> reconhecem. Veja como a coluna K (taxa de pagamento) se comporta com ele na planilha de teste.

### Proteções

| Risco                                            | Proteção                                                                                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clique duplo, nova tentativa, atualizar a página | O mesmo código é reaproveitado; o script, dentro de uma trava, não grava um código que já esteja em Pedidos                                                                                                  |
| Dois pedidos ao mesmo tempo                      | `LockService`: uma gravação por vez, cada uma na sua linha                                                                                                                                                   |
| Falha no meio da gravação                        | Itens primeiro, Pedidos por último; em erro, o script desfaz o que escreveu. Se sobrar algo, a próxima tentativa limpa e regrava, e o menu **Cookies Kaiju → Verificar pedidos incompletos** mostra os casos |
| Alguém chamar o script direto                    | Assinatura HMAC com segredo, válida por 5 minutos, e nonce de uso único                                                                                                                                      |
| Preço ou frete adulterado no navegador           | Sabores e disponibilidade vêm do código do site; o frete só vale com cotação assinada pelo servidor; a promoção é recalculada no servidor                                                                    |
| Abuso da rota                                    | Limite por IP, tamanho máximo da requisição e as cotas do Apps Script                                                                                                                                        |
| Planilha fora do ar                              | O WhatsApp funciona igual; o site tenta de novo, e um resumo sem dados pessoais fica no navegador por até 24h para reenvio                                                                                   |

## Passo a passo

### 1. Crie a planilha de teste

1. Abra o Painel Comercial, vá em **Arquivo → Fazer uma cópia** e dê o nome **"Painel Comercial – TESTE"**.
2. Use a cópia em todos os passos abaixo. A planilha real só entra no passo 7.

### 2. Gere os dois segredos (no seu computador)

Gere dois valores aleatórios **diferentes**. Qualquer uma destas formas serve:

- No terminal: `openssl rand -hex 32` (rode duas vezes).
- No Node: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (rode duas vezes).

Chame o primeiro de **SEGREDO_PLANILHA** e o segundo de **SEGREDO_FRETE**. Guarde no seu gerenciador de
senhas. **Não cole em mensagens, commits nem arquivos do repositório.**

### 3. Instale o Apps Script na planilha de teste

1. Na cópia, abra **Extensões → Apps Script**.
2. Apague o conteúdo do `Código.gs` que vem pronto e cole o conteúdo de `apps-script/Codigo.gs` deste repositório.
3. Clique em **+ → Script**, crie um arquivo chamado `Nucleo` e cole o conteúdo de `apps-script/Nucleo.gs`.
4. Em **Configurações do projeto** (ícone de engrenagem):
   - Marque **Mostrar o arquivo de manifesto "appsscript.json"** e substitua o conteúdo dele pelo de `apps-script/appsscript.json`.
   - Confira se o **fuso horário** é `(GMT-03:00) São Paulo`.
   - Em **Propriedades do script**, adicione:
     - `SEGREDO` = SEGREDO_PLANILHA
     - `AMBIENTE` = `teste` (só na planilha de teste; isso libera o menu de pedido fictício)
5. Salve e recarregue a planilha. Deve aparecer o menu **Cookies Kaiju**.
6. Rode **Cookies Kaiju → Testar registro (dados fictícios)**. O Google vai pedir autorização: aceite.
   Confira se o pedido fictício apareceu em Pedidos e Itens, com as fórmulas H–M e D–G calculando.

### 4. Publique o App da Web (teste)

1. **Implantar → Nova implantação → App da Web**.
2. **Executar como:** Eu. **Quem pode acessar:** Qualquer pessoa.
3. Copie a URL (termina em `/exec`). Ao abrir no navegador, ela deve mostrar `{"ok":true,"servico":"cookies-kaiju-pedidos"}`.

### 5. Configure a Vercel (só no ambiente Preview)

Em **Vercel → Projeto → Settings → Environment Variables**, cadastre, marcando **apenas Preview**:

| Variável                       | Valor                                  |
| ------------------------------ | -------------------------------------- |
| `NEXT_PUBLIC_REGISTRO_PEDIDOS` | `true`                                 |
| `APPS_SCRIPT_URL`              | a URL `/exec` da planilha de **teste** |
| `APPS_SCRIPT_SEGREDO`          | SEGREDO_PLANILHA                       |
| `FRETE_COTACAO_SEGREDO`        | SEGREDO_FRETE                          |

Faça um push para uma branch (por exemplo `teste-planilha`): a Vercel cria um deploy de Preview com a integração ligada.
A produção continua desligada.

### 6. Teste no Preview

Use o link do Preview e dados fictícios (nome "Teste"; endereço qualquer em Mogi Mirim). Para cada teste, anote o código `CK-...`.

| #   | Teste             | Como fazer                                                                 | Esperado                                                                                                        |
| --- | ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Um sabor          | 1 cookie, entrega                                                          | 1 linha em Pedidos e 1 em Itens, status Pendente, S = Site automático                                           |
| 2   | Vários sabores    | 3 sabores diferentes                                                       | 1 linha em Pedidos e 3 em Itens com o mesmo código                                                              |
| 3   | Entrega           | com CEP                                                                    | C, D e G preenchidos; com 3+ cookies em Mogi Mirim, G = 0 (promoção)                                            |
| 4   | Retirada          | escolha Retirada                                                           | D = 0, G = 0, O = Retirada; combustível (L) = 0                                                                 |
| 5   | Duplo clique      | toque duas vezes rápido em "Enviar"                                        | só 1 linha com o código                                                                                         |
| 6   | Falha de rede     | DevTools → Network → Offline, envie e volte a ficar online                 | WhatsApp abre; "Quase lá" mostra só o código; ao reabrir o site, o pedido aparece na planilha (fila)            |
| 7   | Falha da planilha | Na Vercel (Preview), troque `APPS_SCRIPT_URL` por uma URL inválida e envie | WhatsApp funciona; nada diz "recebido"; log da Vercel mostra `pedidos: falha ao registrar` só com código e erro |
| 8   | Simultâneos       | dois navegadores, enviem ao mesmo tempo                                    | 2 linhas, cada uma com seus itens, nada sobrescrito                                                             |
| 9   | Cancelamento      | mude F para Cancelado                                                      | some do potencial do funil e não entra no faturamento                                                           |
| 10  | Concluído         | mude F para Concluído                                                      | entra em pedidos concluídos, receita e contribuição                                                             |
| 11  | Históricos        | depois de tudo                                                             | os 8 pedidos (IDs 1–8, Histórico manual) intactos                                                               |
| 12  | Indicadores       | compare o Painel antes e depois dos testes 9 e 10                          | valores mudam só com Concluído                                                                                  |

Depois dos testes, rode **Cookies Kaiju → Verificar pedidos incompletos**: deve dizer "Nenhum registro incompleto".

### 7. Ativação em produção (depois da sua aprovação)

1. Na **planilha real**, repita o passo 3, **sem** a propriedade `AMBIENTE`, e o passo 4. Você terá uma URL `/exec` nova.
2. Na Vercel, cadastre as mesmas quatro variáveis marcando **Production**, com a URL da planilha real.
   Pode usar os mesmos segredos ou gerar outros; o importante é que o `SEGREDO` do script e o `APPS_SCRIPT_SEGREDO` sejam iguais.
3. Faça um novo deploy de produção (variáveis novas só valem a partir do próximo deploy).
4. Faça um pedido real pequeno e confira a linha. Se algo der errado, volte `NEXT_PUBLIC_REGISTRO_PEDIDOS` para `false` e faça um novo deploy: o site volta a funcionar exatamente como antes.

## Painel e crescimento além da linha 303

- O script copia as fórmulas da linha de cima quando a próxima linha livre não as tem.
- **O Painel continua contando só até a linha 303.** Quando um pedido passa disso, o log do Apps Script registra o aviso `pedido_alem_do_limite`.
- Antes de chegar lá (cerca de 295 pedidos, contando os 8 históricos), amplie os intervalos do Painel. Em ordem de preferência:
  1. Trocar `Pedidos!X4:X303` por `Pedidos!X4:X` (intervalo aberto) nas fórmulas do Painel e da aba Metas;
  2. Ou trocar `303` por `2000` em todas elas (**Editar → Localizar e substituir**, marcando "Pesquisar também nas fórmulas").
- Depois de ampliar, ajuste `limiteLinhas` em `Nucleo.gs` (no editor do Apps Script) e publique uma nova versão.
- O funil potencial pode usar, por exemplo, `=SOMASES(Pedidos!H4:H; Pedidos!F4:F; "Pendente"; Pedidos!S4:S; "Site automático")`.

## Rotina da loja

- **Confirmou o pedido no WhatsApp:** procure o código `CK-...` na coluna B e mude o status para **Concluído** depois da entrega.
- **Cliente desistiu:** **Cancelado**. **Cliente nunca mandou a mensagem:** **Abandonado**, quando você decidir; nada muda sozinho.
- **Pedido no WhatsApp sem linha na planilha** (o cliente fechou tudo antes do registro e não voltou ao site):
  lance à mão com o mesmo código da mensagem, para não duplicar se o registro chegar depois.
- **Não ordene a aba Pedidos diretamente**; para ver ordenado, use **Dados → Criar uma visualização com filtro**.
  Ordenar move linhas enquanto um pedido pode estar sendo gravado.

## Alterações no Apps Script

Cada mudança no código exige **Implantar → Gerenciar implantações → editar → Nova versão**. A URL continua a mesma.
O código de referência fica neste repositório (`apps-script/`), coberto por testes (`tests/apps-script-nucleo.test.ts`).
