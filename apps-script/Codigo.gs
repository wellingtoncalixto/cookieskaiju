/**
 * Cookies Kaiju — ligação do núcleo (Nucleo.gs) com o Google Sheets.
 *
 * Configuração (Projeto → Configurações do projeto → Propriedades do script):
 *   SEGREDO     = o mesmo valor de APPS_SCRIPT_SEGREDO na Vercel (nunca coloque no código).
 *   AMBIENTE    = "teste" na planilha de teste (libera o registro fictício). Na planilha real, não crie.
 *   PLANILHA_ID = só se o script for um projeto SEPARADO (criado em script.google.com, e não por
 *                 Extensões → Apps Script dentro da planilha). É o trecho da URL da planilha entre /d/ e /edit.
 *                 Nesse caso, troque o escopo no appsscript.json para .../auth/spreadsheets (ver o guia).
 *
 * Publicação: Implantar → Nova implantação → App da Web → Executar como: eu · Quem pode acessar: Qualquer pessoa.
 * A URL é pública, mas toda chamada precisa de assinatura HMAC válida, recente e com nonce inédito.
 */

function doPost(e) {
  var segredo = PropertiesService.getScriptProperties().getProperty("SEGREDO");
  if (!segredo) return responder({ ok: false, erro: "segredo_nao_configurado" });

  var envelope;
  try {
    envelope = JSON.parse(e.postData.contents);
  } catch (x) {
    return responder({ ok: false, erro: "corpo_invalido" });
  }

  var cache = CacheService.getScriptCache();
  var v = validarEnvelope(envelope, segredo, Date.now(), hmacHex, function (nonce) {
    var chave = "nonce_" + nonce;
    if (cache.get(chave)) return true;
    cache.put(chave, "1", 900); // 15 min, mais que a janela de 5 min da assinatura
    return false;
  });
  if (!v.ok) return responder(v);

  // Uma gravação por vez: impede duplicidade e disputa de linha entre pedidos simultâneos.
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) return responder({ ok: false, erro: "planilha_ocupada" });
  try {
    var r = registrar(planilhaReal(), v.corpo, CONFIG);
    SpreadsheetApp.flush();
    if (r.avisos.length) console.warn("Avisos do registro " + v.corpo.id + ": " + r.avisos.join(", "));
    return responder(r);
  } catch (erro) {
    // Sem dados pessoais (o pedido não tem nenhum): só o ID e a mensagem técnica.
    console.error("Falha ao gravar " + v.corpo.id + ": " + (erro && erro.message));
    return responder({ ok: false, erro: "falha_ao_gravar" });
  } finally {
    trava.releaseLock();
  }
}

/** Abrir a URL no navegador só confirma que o script está publicado (não revela nada). */
function doGet() {
  return responder({ ok: true, servico: "cookies-kaiju-pedidos" });
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hmacHex(mensagem, segredo) {
  var bytes = Utilities.computeHmacSha256Signature(mensagem, segredo, Utilities.Charset.UTF_8);
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? "0" + v : v;
    })
    .join("");
}

// ---------------------------------------------------------------- adaptador da planilha

/**
 * A planilha onde gravar:
 * - script ligado à planilha (Extensões → Apps Script): a própria planilha, sem precisar de ID;
 * - script separado: a planilha da propriedade PLANILHA_ID.
 */
function abrirPlanilha() {
  var id = PropertiesService.getScriptProperties().getProperty("PLANILHA_ID");
  var arquivo = id ? SpreadsheetApp.openById(id.trim()) : SpreadsheetApp.getActiveSpreadsheet();
  if (!arquivo) {
    throw new Error("Planilha não encontrada: crie a propriedade PLANILHA_ID (script separado da planilha).");
  }
  return arquivo;
}

function planilhaReal() {
  var arquivo = abrirPlanilha();
  return {
    pedidos: aba(arquivo.getSheetByName(CONFIG.abaPedidos)),
    itens: aba(arquivo.getSheetByName(CONFIG.abaItens)),
  };
}

function aba(sheet) {
  if (!sheet) throw new Error("Aba não encontrada");
  return {
    ultimaLinha: function () {
      return sheet.getLastRow();
    },
    valoresColuna: function (coluna) {
      var n = sheet.getLastRow() - CONFIG.linhaInicial + 1;
      if (n <= 0) return [];
      return sheet
        .getRange(CONFIG.linhaInicial, coluna, n, 1)
        .getValues()
        .map(function (l) {
          return l[0];
        });
    },
    escrever: function (linha, coluna, valores) {
      sheet.getRange(linha, coluna, 1, valores.length).setValues([valores]);
    },
    limpar: function (linha, coluna, quantidade) {
      sheet.getRange(linha, coluna, 1, quantidade).clearContent();
    },
    temFormula: function (linha, coluna) {
      return sheet.getRange(linha, coluna).getFormula() !== "";
    },
    copiarFormulas: function (deLinha, paraLinha, coluna, quantidade) {
      sheet
        .getRange(deLinha, coluna, 1, quantidade)
        .copyTo(
          sheet.getRange(paraLinha, coluna, 1, quantidade),
          SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
          false,
        );
    },
  };
}

// ---------------------------------------------------------------- menu e funções de conferência

/** Menu "Cookies Kaiju" na planilha (só existe quando o script está ligado à planilha). */
function onOpen() {
  var menu = SpreadsheetApp.getUi()
    .createMenu("Cookies Kaiju")
    .addItem("Verificar pedidos incompletos", "verificarPedidosIncompletos");
  if (PropertiesService.getScriptProperties().getProperty("AMBIENTE") === "teste") {
    menu.addItem("Testar registro (dados fictícios)", "testarRegistroFicticio");
  }
  menu.addToUi();
}

/** Mostra a mensagem na planilha (pelo menu) ou no "Registro de execução" (rodando pelo editor). */
function avisar(texto) {
  try {
    SpreadsheetApp.getUi().alert(texto);
  } catch (e) {
    console.log(texto);
  }
}

/** Pode rodar pelo menu da planilha ou pelo editor (escolha a função e clique em Executar). */
function verificarPedidosIncompletos() {
  var ids = localizarIncompletos(planilhaReal(), CONFIG);
  if (!ids.length) {
    avisar('Nenhum registro incompleto em "' + abrirPlanilha().getName() + '".');
    return;
  }
  avisar(
    "Itens sem a linha em Pedidos (registro interrompido):\n\n" +
      ids.join("\n") +
      "\n\nSe o cliente reenviar, o site limpa e regrava sozinho. " +
      "Para resolver à mão, apague as linhas desses IDs na aba Itens (colunas A a C).",
  );
}

/**
 * Só com AMBIENTE = teste: grava um pedido fictício pelo mesmo caminho do site e diz em qual planilha gravou.
 * Pode rodar pelo menu da planilha ou pelo editor (escolha a função e clique em Executar).
 */
function testarRegistroFicticio() {
  if (PropertiesService.getScriptProperties().getProperty("AMBIENTE") !== "teste") {
    avisar("Teste bloqueado: crie a propriedade AMBIENTE = teste (só na planilha de teste).");
    return;
  }
  var letras = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var id = "CK-000000-";
  for (var i = 0; i < 7; i++) id += letras.charAt(Math.floor(Math.random() * 32));
  var agora = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm").split(" ");
  var trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    var r = registrar(
      planilhaReal(),
      {
        id: id,
        data: agora[0],
        hora: agora[1],
        cidade: "Mogi Mirim",
        distanciaKm: 4.2,
        pagamento: "Pix",
        status: "Pendente",
        frete: 5,
        origem: "site",
        atendimento: "Entrega",
        relacao: "",
        comoConheceu: "",
        tipoRegistro: "Site automático",
        itens: [
          { produto: "Explosão de Nutella", quantidade: 2 },
          { produto: "Kinder", quantidade: 1 },
        ],
      },
      CONFIG,
    );
    SpreadsheetApp.flush();
    var texto = "Pedido fictício " + id + " gravado na linha " + r.linha + ' da planilha "' + abrirPlanilha().getName() + '".';
    if (r.avisos.length) texto += "\nAvisos: " + r.avisos.join(", ");
    avisar(texto);
  } finally {
    trava.releaseLock();
  }
}
