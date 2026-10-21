/**
 * Cookies Kaiju — registro de pedidos do site no Painel Comercial.
 * NÚCLEO: lógica pura, sem chamar serviços do Google (testada no repositório com uma planilha simulada).
 *
 * Regras:
 * - Pedidos: escreve só A–G e N–S da primeira linha livre (coluna B vazia, a partir da linha 4).
 *   As colunas H–M (fórmulas) nunca são escritas.
 * - Itens: escreve só A–C (ID, produto, quantidade). As colunas D–G (preços/custos/fórmulas) nunca são escritas.
 * - Linhas com ID na coluna B (Pedidos) ou A (Itens) nunca são alteradas: os pedidos históricos ficam intactos.
 * - Ordem: primeiro os Itens, por último a linha de Pedidos (que funciona como "confirmação" do registro).
 * - Mesmo ID duas vezes: se já está em Pedidos, responde "duplicado" sem gravar nada.
 * - Itens sem a linha de Pedidos (falha no meio de uma tentativa anterior) são limpos e regravados.
 */

var CONFIG = {
  abaPedidos: "Pedidos",
  abaItens: "Itens",
  /** Primeira linha de dados nas duas abas. */
  linhaInicial: 4,
  /** Até onde vão as fórmulas do Painel. Passou disso, o registro avisa (amplie os intervalos do Painel). */
  limiteLinhas: 303,
  pedidos: {
    colunaId: 2, // B
    colunaBlocoInicio: 1, // A–G
    colunaBlocoFim: 14, // N–S
    colunaFormulas: 8, // H
    quantidadeFormulas: 6, // H–M
  },
  itens: {
    colunaId: 1, // A
    colunaFormulas: 4, // D
    quantidadeFormulas: 4, // D–G
  },
  /** Assinatura válida por 5 minutos (para mais ou para menos). */
  janelaAssinaturaMs: 5 * 60 * 1000,
};

var PADRAO_ID = /^CK-\d{6}-[0-9A-HJKMNP-TV-Z]{7}$/;

// ---------------------------------------------------------------- autenticação

/**
 * Confere o envelope enviado pelo site: { versao, ts, nonce, corpo (texto JSON), assinatura }.
 * assinatura = HMAC-SHA256(`${ts}.${nonce}.${corpo}`, SEGREDO) em hexadecimal.
 * `nonceJaUsado(nonce)` deve registrar o nonce e devolver true se ele já tinha aparecido.
 */
function validarEnvelope(envelope, segredo, agoraMs, hmacHex, nonceJaUsado) {
  if (!envelope || envelope.versao !== 1) return { ok: false, erro: "envelope_invalido" };
  if (
    typeof envelope.ts !== "number" ||
    typeof envelope.nonce !== "string" ||
    typeof envelope.corpo !== "string"
  )
    return { ok: false, erro: "envelope_invalido" };
  if (Math.abs(agoraMs - envelope.ts) > CONFIG.janelaAssinaturaMs)
    return { ok: false, erro: "assinatura_vencida" };
  var esperada = hmacHex(envelope.ts + "." + envelope.nonce + "." + envelope.corpo, segredo);
  if (!textosIguais(esperada, String(envelope.assinatura))) return { ok: false, erro: "assinatura_invalida" };
  if (nonceJaUsado(envelope.nonce)) return { ok: false, erro: "reenvio_bloqueado" };
  var corpo;
  try {
    corpo = JSON.parse(envelope.corpo);
  } catch (e) {
    return { ok: false, erro: "corpo_invalido" };
  }
  var erro = validarCorpo(corpo);
  return erro ? { ok: false, erro: erro } : { ok: true, corpo: corpo };
}

/** Comparação em tempo constante (não revela onde a assinatura difere). */
function textosIguais(a, b) {
  if (a.length !== b.length) return false;
  var dif = 0;
  for (var i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function validarCorpo(c) {
  if (!c || typeof c !== "object") return "corpo_invalido";
  if (!PADRAO_ID.test(String(c.id))) return "id_invalido";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.data)) || !/^\d{2}:\d{2}$/.test(String(c.hora)))
    return "corpo_invalido";
  if (!Array.isArray(c.itens) || c.itens.length === 0 || c.itens.length > 10) return "sem_itens";
  for (var i = 0; i < c.itens.length; i++) {
    var it = c.itens[i];
    if (!it || typeof it.produto !== "string" || !it.produto) return "corpo_invalido";
    if (
      typeof it.quantidade !== "number" ||
      it.quantidade % 1 !== 0 ||
      it.quantidade < 1 ||
      it.quantidade > 50
    )
      return "corpo_invalido";
  }
  var textos = ["cidade", "pagamento", "status", "origem", "atendimento", "tipoRegistro"];
  for (var t = 0; t < textos.length; t++) if (typeof c[textos[t]] !== "string") return "corpo_invalido";
  if (c.distanciaKm !== "" && typeof c.distanciaKm !== "number") return "corpo_invalido";
  if (c.frete !== "" && typeof c.frete !== "number") return "corpo_invalido";
  return null;
}

// ---------------------------------------------------------------- gravação

/**
 * Grava o pedido. `planilha` = { pedidos: Aba, itens: Aba }, onde Aba tem:
 *   valoresColuna(coluna) → valores da linha inicial até a última linha
 *   ultimaLinha() · escrever(linha, coluna, valores[]) · limpar(linha, coluna, quantidade)
 *   temFormula(linha, coluna) · copiarFormulas(deLinha, paraLinha, coluna, quantidade)
 * Deve ser chamada dentro de uma trava (LockService) para evitar corrida entre pedidos simultâneos.
 */
function registrar(planilha, corpo, cfg) {
  cfg = cfg || CONFIG;
  var avisos = [];

  // 1. Já registrado? Nada a fazer (clique duplo, nova tentativa, reenvio).
  if (linhasComValor(planilha.pedidos, cfg.pedidos.colunaId, corpo.id, cfg).length > 0) {
    return { ok: true, duplicado: true, avisos: avisos };
  }

  // 2. Itens de uma tentativa anterior que falhou no meio (sem a linha de Pedidos): limpa antes de regravar.
  var orfas = linhasComValor(planilha.itens, cfg.itens.colunaId, corpo.id, cfg);
  for (var o = 0; o < orfas.length; o++) planilha.itens.limpar(orfas[o], 1, 3);
  if (orfas.length) avisos.push("itens_incompletos_recuperados:" + orfas.length);

  var escritas = { itens: [], pedido: null };
  try {
    // 3. Itens (A–C).
    var linhasItens = linhasLivres(planilha.itens, cfg.itens.colunaId, corpo.itens.length, cfg);
    for (var i = 0; i < corpo.itens.length; i++) {
      var li = linhasItens[i];
      garantirFormulas(
        planilha.itens,
        li,
        cfg.itens.colunaFormulas,
        cfg.itens.quantidadeFormulas,
        cfg,
        avisos,
      );
      planilha.itens.escrever(li, 1, [corpo.id, corpo.itens[i].produto, corpo.itens[i].quantidade]);
      escritas.itens.push(li);
      if (li > cfg.limiteLinhas) avisos.push("itens_alem_do_limite:" + li);
    }

    // 4. Pedidos (A–G e N–S), por último.
    var lp = linhasLivres(planilha.pedidos, cfg.pedidos.colunaId, 1, cfg)[0];
    garantirFormulas(
      planilha.pedidos,
      lp,
      cfg.pedidos.colunaFormulas,
      cfg.pedidos.quantidadeFormulas,
      cfg,
      avisos,
    );
    var blocos = valoresPedido(corpo);
    planilha.pedidos.escrever(lp, cfg.pedidos.colunaBlocoInicio, blocos.aAteG);
    escritas.pedido = lp;
    planilha.pedidos.escrever(lp, cfg.pedidos.colunaBlocoFim, blocos.nAteS);
    if (lp > cfg.limiteLinhas) avisos.push("pedido_alem_do_limite:" + lp);
  } catch (erro) {
    // Desfaz o que foi escrito nesta tentativa: a planilha nunca fica com um registro pela metade.
    for (var d = 0; d < escritas.itens.length; d++) planilha.itens.limpar(escritas.itens[d], 1, 3);
    if (escritas.pedido) {
      planilha.pedidos.limpar(escritas.pedido, cfg.pedidos.colunaBlocoInicio, 7);
      planilha.pedidos.limpar(escritas.pedido, cfg.pedidos.colunaBlocoFim, 6);
    }
    throw erro;
  }
  return { ok: true, duplicado: false, linha: lp, avisos: avisos };
}

/** Valores das colunas A–G e N–S, na ordem da aba Pedidos. */
function valoresPedido(c) {
  var p = String(c.data).split("-");
  var data = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return {
    // A Data · B ID · C Cidade · D Distância ida km · E Pagamento · F Status · G Frete cobrado
    aAteG: [data, c.id, c.cidade, c.distanciaKm, c.pagamento, c.status, c.frete],
    // N Origem · O Tipo de atendimento · P Relação · Q Como conheceu · R Hora · S Tipo de registro
    nAteS: [c.origem, c.atendimento, c.relacao || "", c.comoConheceu || "", c.hora, c.tipoRegistro],
  };
}

/** IDs que estão em Itens mas não em Pedidos (registros incompletos, para conferência manual). */
function localizarIncompletos(planilha, cfg) {
  cfg = cfg || CONFIG;
  var noPedido = {};
  var ids = planilha.pedidos.valoresColuna(cfg.pedidos.colunaId);
  for (var i = 0; i < ids.length; i++) if (!vazio(ids[i])) noPedido[String(ids[i])] = true;
  var resultado = [];
  var vistos = {};
  var itens = planilha.itens.valoresColuna(cfg.itens.colunaId);
  for (var j = 0; j < itens.length; j++) {
    var id = String(itens[j]);
    if (PADRAO_ID.test(id) && !noPedido[id] && !vistos[id]) {
      vistos[id] = true;
      resultado.push(id);
    }
  }
  return resultado;
}

// ---------------------------------------------------------------- auxiliares

function vazio(v) {
  return v === "" || v === null || v === undefined;
}

function linhasComValor(aba, coluna, valor, cfg) {
  var vals = aba.valoresColuna(coluna);
  var linhas = [];
  for (var i = 0; i < vals.length; i++) if (String(vals[i]) === valor) linhas.push(cfg.linhaInicial + i);
  return linhas;
}

/** As `n` primeiras linhas com a coluna-chave vazia (reaproveita buracos; depois, abaixo da última). */
function linhasLivres(aba, coluna, n, cfg) {
  var vals = aba.valoresColuna(coluna);
  var livres = [];
  for (var i = 0; i < vals.length && livres.length < n; i++)
    if (vazio(vals[i])) livres.push(cfg.linhaInicial + i);
  var proxima = Math.max(aba.ultimaLinha() + 1, cfg.linhaInicial);
  while (livres.length < n) livres.push(proxima++);
  return livres;
}

/** Se a linha não tem as fórmulas (passou do intervalo preenchido), copia da linha mais próxima acima que tem. */
function garantirFormulas(aba, linha, coluna, quantidade, cfg, avisos) {
  if (aba.temFormula(linha, coluna)) return;
  for (var l = linha - 1; l >= cfg.linhaInicial; l--) {
    if (aba.temFormula(l, coluna)) {
      aba.copiarFormulas(l, linha, coluna, quantidade);
      return;
    }
  }
  avisos.push("sem_formula_modelo:" + linha);
}
