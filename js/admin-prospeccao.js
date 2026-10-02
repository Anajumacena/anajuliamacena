/*
  Aba Prospecção: escreve o e-mail, mostra a prévia, envia pelo
  sistema (função "enviar-emails" no Supabase) ou monta rascunhos
  pra abrir no Gmail, e guarda o histórico.

  Os e-mails vêm SEMPRE da aba Marcas. Nenhuma chave secreta mora
  neste arquivo: a chave do Resend fica só no painel do Supabase.
  Se faltar alguma tabela, a aba avisa o que falta e continua
  funcionando no que dá.
*/

(function () {
  "use strict";

  var EMAIL_DONA = "anajuliarmacena@gmail.com";
  var LINK_SITE = "https://anajumacena.github.io/anajuliamacena/";
  var CHAVE_LOCAL = "prospeccao_rascunho_v1";
  var TAMANHO_LOTE = 100;
  var ROTULOS_SITUACAO = { lead: "Lead", conversando: "Conversando", cliente: "Cliente", parada: "Parada" };

  var TEXTO_PADRAO = {
    assunto: "Ideia de conteúdo para a {{marca}}",
    texto:
      "Oi, {{nome}}! Tudo bem?\n\n" +
      "Eu sou a Ana Julia, criadora de conteúdo UGC, e adoraria criar vídeos para a {{marca}}.\n\n" +
      "Reuni alguns trabalhos meus no portfólio. Se fizer sentido, é só me responder aqui que eu te mando uma proposta.\n\n" +
      "Um abraço,\nAna Julia Macena",
    botaoTexto: "Ver meu portfólio",
    botaoLink: LINK_SITE
  };

  var marcas = [];
  var envios = [];
  var optouts = [];
  var tabelaEnviosOk = false;
  var tabelaOptoutOk = false;
  var colunaSelecaoOk = true;
  var carregou = false;

  var modoEscrita = "facil";
  var metodo = "resend";
  var testeFeito = false;
  var enviando = false;
  var jaConfigurado = false;
  var fila = [];

  function el(id) { return document.getElementById(id); }
  function esc(v) { return Admin.escapeHtml(v); }

  // ---------------------------------------------------------
  // Texto, variáveis e montagem do e-mail
  // ---------------------------------------------------------

  function primeiroNome(marca) {
    return (marca || "").trim().split(/\s+/)[0] || "";
  }

  function trocarVariaveis(texto, marca, escapar) {
    var nome = primeiroNome(marca);
    var m = escapar ? esc(marca) : marca;
    var n = escapar ? esc(nome) : nome;
    return String(texto || "")
      .replace(/\{\{\s*nome\s*\}\}/gi, n)
      .replace(/\{\{\s*marca\s*\}\}/gi, m);
  }

  // Modo fácil: transforma o texto simples num e-mail limpo
  // (fundo branco, letra escura, largura máxima de 560px).
  function montarHtmlFacil(texto, botaoTexto, botaoLink) {
    var seguro = esc(texto || "");
    seguro = seguro.replace(/(https?:\/\/[^\s<]+)/g, function (url) {
      return '<a href="' + url + '" style="color:#222222;text-decoration:underline;">' + url + "</a>";
    });
    var paragrafos = seguro.split(/\n{2,}/).map(function (p) {
      return '<p style="margin:0 0 16px;">' + p.replace(/\n/g, "<br>") + "</p>";
    }).join("\n");

    var botao = "";
    if ((botaoTexto || "").trim() && (botaoLink || "").trim()) {
      botao =
        '<p style="margin:24px 0;"><a href="' + esc(botaoLink.trim()) + '" style="display:inline-block;background:#222222;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;">' +
        esc(botaoTexto.trim()) + "</a></p>\n";
    }

    return (
      '<!DOCTYPE html>\n<html lang="pt-BR">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>\n' +
      '<body style="margin:0;padding:0;background:#ffffff;">\n' +
      '<div style="max-width:560px;margin:0 auto;padding:24px 20px;background:#ffffff;color:#222222;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;">\n' +
      paragrafos + "\n" + botao +
      '<p style="margin:32px 0 0;font-size:12px;color:#777777;">Se você não quiser mais receber meus e-mails, é só responder SAIR.</p>\n' +
      "</div>\n</body>\n</html>"
    );
  }

  function htmlParaTexto(html) {
    var corpo = String(html || "");
    var m = corpo.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (m) corpo = m[1];
    corpo = corpo.replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n\n")
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, function (x, link, rotulo) {
        var r = rotulo.replace(/<[^>]+>/g, "").trim();
        return r && r !== link ? r + " (" + link + ")" : link;
      })
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return corpo.replace(/\n{3,}/g, "\n\n").trim();
  }

  function htmlAtual() {
    if (modoEscrita === "html") return el("prHtml").value;
    return montarHtmlFacil(el("prTexto").value, el("prBotaoTexto").value, el("prBotaoLink").value);
  }

  function textoPlanoModelo() {
    if (modoEscrita === "html") return htmlParaTexto(el("prHtml").value);
    var texto = el("prTexto").value.trim();
    var bt = el("prBotaoTexto").value.trim();
    var bl = el("prBotaoLink").value.trim();
    if (bt && bl) texto += "\n\n" + bt + ": " + bl;
    texto += "\n\nSe você não quiser mais receber meus e-mails, é só responder SAIR.";
    return texto;
  }

  // ---------------------------------------------------------
  // Guardar o que ela escreveu (só neste navegador)
  // ---------------------------------------------------------

  function salvarLocal() {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify({
        assunto: el("prAssunto").value,
        texto: el("prTexto").value,
        botaoTexto: el("prBotaoTexto").value,
        botaoLink: el("prBotaoLink").value,
        html: el("prHtml").value,
        modo: modoEscrita
      }));
    } catch (e) { /* sem armazenamento: tudo bem, só não lembra */ }
  }

  function carregarLocal() {
    var salvo = null;
    try { salvo = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || "null"); } catch (e) { salvo = null; }
    salvo = salvo || {};
    el("prAssunto").value = salvo.assunto !== undefined ? salvo.assunto : TEXTO_PADRAO.assunto;
    el("prTexto").value = salvo.texto !== undefined ? salvo.texto : TEXTO_PADRAO.texto;
    el("prBotaoTexto").value = salvo.botaoTexto !== undefined ? salvo.botaoTexto : TEXTO_PADRAO.botaoTexto;
    el("prBotaoLink").value = salvo.botaoLink !== undefined ? salvo.botaoLink : TEXTO_PADRAO.botaoLink;
    el("prHtml").value = salvo.html || "";
    definirModoEscrita(salvo.modo === "html" ? "html" : "facil", true);
  }

  function definirModoEscrita(modo, semAviso) {
    modoEscrita = modo;
    document.querySelectorAll("#prModosEscrita .filtro-pilula-botao").forEach(function (b) {
      b.classList.toggle("ativo", b.getAttribute("data-modo") === modo);
    });
    el("prPainelFacil").hidden = modo !== "facil";
    el("prPainelHtml").hidden = modo !== "html";
    if (modo === "html" && !el("prHtml").value.trim() && !semAviso) {
      el("prHtml").value = montarHtmlFacil(el("prTexto").value, el("prBotaoTexto").value, el("prBotaoLink").value);
    }
    aoMudarConteudo();
  }

  function aoMudarConteudo() {
    testeFeito = false;
    if (el("prStatusTeste")) el("prStatusTeste").textContent = "";
    salvarLocal();
    atualizarPrevia();
    atualizarBotaoDisparo();
  }

  // ---------------------------------------------------------
  // Carregar dados do banco
  // ---------------------------------------------------------

  async function carregarDados() {
    Admin.limparAvisos("avisosProspeccao");

    var rMarcas = await window.banco.from("marcas").select("*").order("nome", { ascending: true });
    if (rMarcas.error) {
      marcas = [];
      Admin.mostrarAviso("avisosProspeccao", "Não consegui carregar as marcas agora: " + rMarcas.error.message, "erro");
    } else {
      marcas = rMarcas.data || [];
    }
    colunaSelecaoOk = marcas.length === 0 || Object.prototype.hasOwnProperty.call(marcas[0], "selecionada");

    var rEnvios = await window.banco.from("email_envios")
      .select("email, assunto, status, erro, criado_em")
      .order("criado_em", { ascending: false }).limit(1000);
    tabelaEnviosOk = !rEnvios.error;
    envios = rEnvios.error ? [] : (rEnvios.data || []);

    var rOptout = await window.banco.from("email_optout")
      .select("email, criado_em").order("criado_em", { ascending: false });
    tabelaOptoutOk = !rOptout.error;
    optouts = rOptout.error ? [] : (rOptout.data || []);

    var faltando = [];
    if (!tabelaEnviosOk) faltando.push("email_envios (histórico de envios)");
    if (!tabelaOptoutOk) faltando.push("email_optout (lista de quem pediu pra sair)");
    if (faltando.length) {
      Admin.mostrarAviso("avisosProspeccao",
        "Falta criar no banco: " + faltando.join(" e ") + ". Abra o arquivo disparo.sql do seu projeto, cole no Supabase (SQL Editor, New query, Run). Enquanto isso você pode escrever o e-mail e usar o modo Rascunho no Gmail, mas o envio pelo sistema fica bloqueado.",
        "aviso");
    }
    if (!colunaSelecaoOk) {
      Admin.mostrarAviso("avisosProspeccao",
        'Falta a coluna "selecionada" na tabela de marcas. O arquivo disparo.sql também cria ela. Sem isso, a opção "só as marcas selecionadas" não funciona.',
        "aviso");
    }
    carregou = true;
  }

  // ---------------------------------------------------------
  // Números do topo
  // ---------------------------------------------------------

  function emailValido(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function emailDe(m) { return (m.email || "").trim().toLowerCase(); }

  function conjuntoOptout() {
    var s = {};
    optouts.forEach(function (o) { s[(o.email || "").toLowerCase()] = true; });
    return s;
  }

  function atualizarNumeros() {
    var traco = "-";
    var base = {};
    marcas.forEach(function (m) { var e = emailDe(m); if (emailValido(e)) base[e] = true; });
    var emailsBase = Object.keys(base);
    el("prKpiBase").textContent = emailsBase.length;

    var receberam = {};
    var totalOk = 0;
    var falhas = 0;
    envios.forEach(function (l) {
      if (l.status === "ok") { receberam[(l.email || "").toLowerCase()] = true; totalOk++; }
      else falhas++;
    });
    var saiu = conjuntoOptout();

    if (tabelaEnviosOk) {
      el("prKpiRecebido").textContent = Object.keys(receberam).length;
      el("prKpiFalhas").textContent = falhas;
      el("prTotalEnviados").textContent = totalOk > 0 ? totalOk : traco;
    } else {
      el("prKpiRecebido").textContent = traco;
      el("prKpiFalhas").textContent = traco;
      el("prTotalEnviados").textContent = traco;
    }
    el("prKpiSairam").textContent = tabelaOptoutOk ? optouts.length : traco;

    if (tabelaEnviosOk && tabelaOptoutOk) {
      var aEnviar = emailsBase.filter(function (e) { return !receberam[e] && !saiu[e]; }).length;
      el("prKpiAEnviar").textContent = aEnviar;
    } else {
      el("prKpiAEnviar").textContent = traco;
    }
  }

  // ---------------------------------------------------------
  // Quem recebe
  // ---------------------------------------------------------

  function marcasComEmail(lista) { return lista.filter(function (m) { return emailValido(emailDe(m)); }); }

  function montarOpcoesPublico() {
    var select = el("prPublico");
    var anterior = select.value;
    var selecionadas = marcasComEmail(marcas.filter(function (m) { return m.selecionada === true; })).length;
    var comEmail = marcasComEmail(marcas).length;
    var html =
      '<option value="selecionadas">Só as marcas selecionadas (' + selecionadas + ")</option>" +
      '<option value="teste">Só eu (teste)</option>' +
      '<option value="todos">Todas as marcas com e-mail (' + comEmail + ")</option>";
    ["lead", "conversando", "cliente", "parada"].forEach(function (sit) {
      var n = marcasComEmail(marcas.filter(function (m) { return m.situacao === sit; })).length;
      var total = marcas.filter(function (m) { return m.situacao === sit; }).length;
      if (total > 0) html += '<option value="sit:' + sit + '">Situação: ' + ROTULOS_SITUACAO[sit] + " (" + n + ")</option>";
    });
    select.innerHTML = html;
    select.value = anterior && select.querySelector('option[value="' + anterior + '"]') ? anterior : "selecionadas";
  }

  function nomeDaLista() {
    var o = el("prPublico").selectedOptions[0];
    return o ? o.textContent.replace(/\s*\(\d+\)\s*$/, "") : "";
  }

  // Devolve quem vai receber, já sem repetidos e sem quem pediu pra sair.
  function destinatariosAtuais() {
    var valor = el("prPublico").value;
    if (valor === "teste") {
      return { lista: [{ id: null, email: EMAIL_DONA, marca: exemploMarcaBase() }], semEmail: 0, repetidos: 0, saiu: 0 };
    }
    var grupo = marcas.filter(function (m) {
      if (valor === "selecionadas") return m.selecionada === true;
      if (valor.indexOf("sit:") === 0) return m.situacao === valor.slice(4);
      return true;
    });
    var saiu = conjuntoOptout();
    var vistos = {};
    var lista = [];
    var semEmail = 0, repetidos = 0, sairam = 0;
    grupo.forEach(function (m) {
      var e = emailDe(m);
      if (!emailValido(e)) { semEmail++; return; }
      if (saiu[e]) { sairam++; return; }
      if (vistos[e]) { repetidos++; return; }
      vistos[e] = true;
      lista.push({ id: m.id, email: e, marca: m.nome });
    });
    return { lista: lista, semEmail: semEmail, repetidos: repetidos, saiu: sairam };
  }

  function exemploMarcaBase() {
    var sel = marcas.filter(function (m) { return m.selecionada === true && m.nome; })[0];
    return sel ? sel.nome : "Studio Aurora";
  }

  function atualizarContagem() {
    var info = destinatariosAtuais();
    var n = info.lista.length;
    var valor = el("prPublico").value;
    el("prContagem").innerHTML = valor === "teste"
      ? "O e-mail vai só para <strong>você</strong>."
      : "Vai para <strong>" + n + (n === 1 ? " e-mail" : " e-mails") + "</strong>.";

    var detalhes = [];
    if (info.semEmail > 0) detalhes.push(info.semEmail + (info.semEmail === 1 ? " marca ficou de fora por não ter e-mail" : " marcas ficaram de fora por não terem e-mail"));
    if (info.repetidos > 0) detalhes.push(info.repetidos + " com e-mail repetido (cada e-mail recebe uma vez só)");
    if (info.saiu > 0) detalhes.push(info.saiu + " pediram pra sair");
    el("prDetalheContagem").textContent = detalhes.join(". ") + (detalhes.length ? "." : "");

    el("prSemSelecao").hidden = !(valor === "selecionadas" && n === 0);
    atualizarBotaoDisparo();
  }

  function mostrarOuEsconderCorpo() {
    var tem = marcasComEmail(marcas).length > 0;
    el("prSemEmail").hidden = tem;
    el("prCorpo").hidden = !tem;
    if (!tem) {
      el("prSemEmailTexto").textContent = marcas.length === 0
        ? "Você ainda não tem marcas cadastradas. Cadastre ou importe suas marcas na aba Marcas, com o e-mail de cada uma."
        : "Nenhuma das suas marcas tem e-mail cadastrado ainda. Preencha os e-mails na aba Marcas.";
    }
  }

  // ---------------------------------------------------------
  // Prévia
  // ---------------------------------------------------------

  function pintarIframe(iframe, html) {
    iframe.onload = function () {
      try {
        var doc = iframe.contentDocument;
        if (doc && doc.documentElement) iframe.style.height = Math.max(220, doc.documentElement.scrollHeight) + "px";
      } catch (e) { /* mantém a altura mínima */ }
    };
    iframe.srcdoc = html;
  }

  function atualizarPrevia() {
    var marcaExemplo = exemploMarcaBase();
    var assunto = trocarVariaveis(el("prAssunto").value, marcaExemplo, false).trim() || "(sem assunto)";
    var html = trocarVariaveis(htmlAtual(), marcaExemplo, true);
    el("prExemplo").textContent = "Exemplo com a marca: " + marcaExemplo;
    el("prPrevAssunto").textContent = assunto;
    el("prCheiaAssunto").textContent = assunto;
    pintarIframe(el("prPrevCorpo"), html);
    if (!el("modalPreviaCheia").hidden) pintarIframe(el("prCheiaCorpo"), html);
  }

  function abrirTelaCheia() {
    atualizarPrevia();
    pintarIframe(el("prCheiaCorpo"), trocarVariaveis(htmlAtual(), exemploMarcaBase(), true));
    Admin.abrirModal("modalPreviaCheia");
  }

  // ---------------------------------------------------------
  // Chamar a função do Supabase
  // ---------------------------------------------------------

  async function chamarFuncao(corpo) {
    try {
      var r = await window.banco.functions.invoke("enviar-emails", { body: corpo });
      if (r.error) {
        var dados = null;
        if (r.error.context && typeof r.error.context.json === "function") {
          try { dados = await r.error.context.json(); } catch (e) { dados = null; }
        }
        if (dados && dados.erro) return { ok: false, erro: dados.erro, codigo: dados.codigo };
        var status = r.error.context && r.error.context.status;
        if (status === 404 || r.error.name === "FunctionsFetchError" || /Failed to send a request/i.test(r.error.message || "")) {
          return { ok: false, codigo: "nao_publicada", erro: 'Não consegui falar com a função "enviar-emails". Ela provavelmente ainda não foi publicada no Supabase, ou está com outro nome.' };
        }
        return { ok: false, erro: r.error.message || "Erro desconhecido na função de envio." };
      }
      return { ok: true, dados: r.data };
    } catch (e) {
      return { ok: false, erro: "Erro de conexão: " + (e && e.message ? e.message : e) };
    }
  }

  // ---------------------------------------------------------
  // Teste e disparo
  // ---------------------------------------------------------

  function atualizarBotaoDisparo() {
    var botao = el("prBotaoDisparar");
    var n = destinatariosAtuais().lista.length;
    var bloqueio = "";
    if (!tabelaEnviosOk || !tabelaOptoutOk) bloqueio = "Falta criar as tabelas no Supabase (disparo.sql).";
    else if (n === 0) bloqueio = "Não há ninguém na lista escolhida.";
    else if (!testeFeito) bloqueio = "Envie o teste pra você primeiro.";
    botao.disabled = enviando || bloqueio !== "";
    botao.title = bloqueio;
    el("prBotaoTeste").disabled = enviando;
  }

  function validarConteudo() {
    if (!el("prAssunto").value.trim()) { window.alert("Escreva o assunto do e-mail."); return false; }
    var vazio = modoEscrita === "html" ? !el("prHtml").value.trim() : !el("prTexto").value.trim();
    if (vazio) { window.alert("Escreva o texto do e-mail."); return false; }
    return true;
  }

  async function enviarTeste() {
    if (enviando || !validarConteudo()) return;
    enviando = true;
    atualizarBotaoDisparo();
    var status = el("prStatusTeste");
    status.style.color = "var(--texto-suave)";
    status.textContent = "Enviando o teste...";
    var r = await chamarFuncao({
      teste: true,
      assunto: el("prAssunto").value.trim(),
      html: htmlAtual(),
      destinatarios: [{ email: EMAIL_DONA, marca: exemploMarcaBase() }]
    });
    enviando = false;
    if (!r.ok) {
      status.style.color = "var(--erro)";
      status.textContent = explicarErro(r);
    } else if (r.dados.enviados > 0) {
      testeFeito = true;
      status.style.color = "var(--ok)";
      status.textContent = "Teste enviado para " + EMAIL_DONA + ". Olhe a caixa de entrada (e o spam), abra no celular e confira se o nome da marca ficou no lugar certo. Agora o botão de disparo está liberado.";
    } else {
      var motivo = r.dados.resultados && r.dados.resultados[0] && r.dados.resultados[0].erro;
      status.style.color = "var(--erro)";
      status.textContent = "O teste não saiu" + (motivo ? ": " + motivo : ".") + (r.dados.cota_acabou ? " O limite diário de envios do Resend acabou." : "");
    }
    atualizarBotaoDisparo();
  }

  function explicarErro(r) {
    if (r.codigo === "sem_chave") return "A chave do Resend ainda não foi colada no Supabase (segredo RESEND_API_KEY). Veja o passo a passo que a Claude te enviou.";
    if (r.codigo === "sem_tabela") return r.erro;
    if (r.codigo === "sem_permissao" || r.codigo === "sem_login") return "O sistema não reconheceu o seu login. Saia do painel, entre de novo e tente outra vez.";
    return r.erro || "Erro desconhecido.";
  }

  function pedirConfirmacao() {
    if (enviando || !validarConteudo()) return;
    if (!testeFeito) { window.alert("Envie o teste pra você primeiro."); return; }
    var info = destinatariosAtuais();
    if (info.lista.length === 0) { window.alert("Não há ninguém na lista escolhida."); return; }
    if (modoEscrita === "html" && !/sair/i.test(el("prHtml").value)) {
      if (!window.confirm('O seu HTML não tem o aviso "responda SAIR" no rodapé. Sem ele, quem não quer receber não sabe como pedir. Quer enviar mesmo assim?')) return;
    }
    var n = info.lista.length;
    el("prConfirmarTexto").textContent =
      "Vai para " + n + (n === 1 ? " marca" : " marcas") + ', da lista "' + nomeDaLista() + '", e não dá pra desfazer.';
    el("prConfirmarAssunto").textContent = "Assunto: " + el("prAssunto").value.trim();
    Admin.abrirModal("modalConfirmarEnvio");
  }

  async function executarDisparo() {
    Admin.fecharModal("modalConfirmarEnvio");
    if (enviando) return;
    var info = destinatariosAtuais();
    var lista = info.lista;
    if (lista.length === 0) return;

    var eraSelecao = el("prPublico").value === "selecionadas";
    var assunto = el("prAssunto").value.trim();
    var html = htmlAtual();
    var pular = el("prPular").checked;

    enviando = true;
    atualizarBotaoDisparo();
    el("prResultado").innerHTML = "";
    el("prProgresso").hidden = false;
    var barra = el("prProgressoBarra");
    var rotulo = el("prProgressoRotulo");
    barra.style.width = "0%";
    rotulo.textContent = "Começando...";

    var total = { enviados: 0, falhas: 0, pulados: 0 };
    var emailsOk = [];
    var parou = null;
    var restantes = 0;
    var textoErro = "";
    var processados = 0;

    try {
      for (var i = 0; i < lista.length; i += TAMANHO_LOTE) {
        var pedaco = lista.slice(i, i + TAMANHO_LOTE);
        rotulo.textContent = "Enviando " + (i + 1) + " a " + (i + pedaco.length) + " de " + lista.length + "...";
        var r = await chamarFuncao({
          assunto: assunto,
          html: html,
          pular_ja_enviados: pular,
          destinatarios: pedaco.map(function (d) { return { email: d.email, marca: d.marca }; })
        });
        if (!r.ok) {
          parou = "erro";
          textoErro = explicarErro(r);
          restantes = lista.length - i;
          break;
        }
        var d = r.dados;
        total.enviados += d.enviados || 0;
        total.falhas += d.falhas || 0;
        total.pulados += d.pulados || 0;
        (d.resultados || []).forEach(function (x) { if (x.status === "ok") emailsOk.push(x.email); });
        processados = i + pedaco.length;
        barra.style.width = Math.round((processados / lista.length) * 100) + "%";

        if (d.cota_acabou) {
          parou = "cota";
          restantes = (lista.length - processados) + (d.restantes || 0);
          break;
        }
        if (d.sem_dominio) {
          parou = "dominio";
          restantes = (lista.length - processados) + (d.restantes || 0);
          break;
        }
      }
    } catch (e) {
      parou = "erro";
      textoErro = "Parou por um erro inesperado: " + (e && e.message ? e.message : e);
    }

    if (!parou) { barra.style.width = "100%"; rotulo.textContent = "Concluído."; }
    else rotulo.textContent = "Parou antes de terminar.";

    if (emailsOk.length > 0) await marcarComoEnviadas(emailsOk);
    mostrarResultado(total, parou, restantes, textoErro);

    enviando = false;
    testeFeito = false;
    await carregarDados();
    atualizarTudo();

    if (eraSelecao && emailsOk.length > 0 && colunaSelecaoOk) Admin.abrirModal("modalLimparSelecao");
  }

  function mostrarResultado(total, parou, restantes, textoErro) {
    var html = '<div class="caixa-resumo"><div class="numeros">' +
      "<div><b>" + total.enviados + "</b>enviados</div>" +
      "<div><b>" + total.falhas + "</b>falharam</div>" +
      "<div><b>" + total.pulados + "</b>pulados</div></div>";
    if (parou === "cota") {
      html += "<p style=\"margin:0;\"><strong>O limite diário de envios do Resend acabou.</strong> Foram enviados " + total.enviados +
        " e faltam " + restantes + ". Isso é normal no plano grátis. Volte amanhã, abra esta aba, escolha a mesma lista, cole o mesmo assunto e o mesmo texto (o texto fica salvo neste navegador) e deixe marcado \"Pular quem já recebeu este mesmo assunto\". O sistema pula quem já recebeu e continua de onde parou.</p>";
    } else if (parou === "dominio") {
      html += "<p style=\"margin:0;\"><strong>O Resend só entrega para o seu próprio e-mail enquanto você não verifica um domínio.</strong> Faltaram " + restantes +
        ". Verifique um domínio no Resend (ou use o modo Rascunho no Gmail) e tente de novo.</p>";
    } else if (parou === "erro") {
      html += "<p style=\"margin:0;\"><strong>O disparo parou no meio.</strong> " + esc(textoErro) +
        " Confira o histórico abaixo para ver quem já recebeu. Na próxima tentativa, deixe marcado \"Pular quem já recebeu este mesmo assunto\".</p>";
    } else if (total.falhas > 0) {
      html += '<p style="margin:0;">Alguns e-mails não saíram. O motivo de cada um está no histórico abaixo.</p>';
    } else {
      html += '<p style="margin:0;">Tudo certo. As marcas que receberam ficaram com a data de hoje em "Último contato".</p>';
    }
    html += "</div>";
    el("prResultado").innerHTML = html;
  }

  // Marca as marcas que receberam com a data de hoje (Último contato).
  async function marcarComoEnviadas(emails) {
    var porEmail = {};
    emails.forEach(function (e) { porEmail[e.toLowerCase()] = true; });
    var ids = marcas.filter(function (m) { return porEmail[emailDe(m)]; }).map(function (m) { return m.id; });
    var hoje = Admin.hojeISO();
    for (var i = 0; i < ids.length; i += 100) {
      try {
        await window.banco.from("marcas").update({ ultimo_contato: hoje }).in("id", ids.slice(i, i + 100));
      } catch (e) { /* o envio já foi feito; só a data não foi marcada */ }
    }
  }

  async function limparSelecaoAgora() {
    Admin.fecharModal("modalLimparSelecao");
    var r = await window.banco.from("marcas").update({ selecionada: false }).eq("selecionada", true);
    if (r.error) { window.alert("Não consegui limpar a seleção: " + r.error.message); return; }
    await carregarDados();
    atualizarTudo();
  }

  // ---------------------------------------------------------
  // Rascunho no Gmail (plano B, sem o sistema de envio)
  // ---------------------------------------------------------

  function montarFila() {
    if (!validarConteudo()) return;
    var info = destinatariosAtuais();
    fila = info.lista.slice();
    if (fila.length === 0) { el("prFila").innerHTML = '<p class="texto-vazio">Ninguém na lista escolhida.</p>'; return; }
    desenharFila();
  }

  function desenharFila() {
    var area = el("prFila");
    if (fila.length === 0) {
      area.innerHTML = '<div class="ok-caixa">A fila acabou. Todas as marcas foram tratadas.</div>';
      return;
    }
    var atual = fila[0];
    var assunto = trocarVariaveis(el("prAssunto").value, atual.marca, false).trim();
    var corpo = trocarVariaveis(textoPlanoModelo(), atual.marca, false);
    area.innerHTML =
      '<div class="pr-fila-cartao">' +
      '<div class="linha"><strong>' + fila.length + (fila.length === 1 ? " marca" : " marcas") + " na fila</strong></div>" +
      '<div class="linha">Para: <strong>' + esc(atual.marca) + "</strong> (" + esc(atual.email) + ")</div>" +
      '<div class="linha">Assunto: ' + esc(assunto) + "</div>" +
      '<textarea id="prFilaTexto" readonly>' + esc(corpo) + "</textarea>" +
      '<div class="pr-acoes">' +
      '<button class="botao contorno-suave" id="prFilaCopiar">Copiar texto</button>' +
      '<button class="botao" id="prFilaGmail">Abrir no Gmail</button>' +
      '<button class="botao principal" id="prFilaEnviado">Marquei como enviado</button>' +
      '<button class="botao contorno-suave" id="prFilaPular">Pular</button>' +
      "</div></div>";

    el("prFilaCopiar").addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(corpo);
        this.textContent = "Copiado!";
      } catch (e) {
        el("prFilaTexto").select();
        window.alert("Não consegui copiar sozinho. O texto está selecionado, aperte Ctrl+C.");
      }
    });
    el("prFilaGmail").addEventListener("click", function () {
      var url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(atual.email) +
        "&su=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(corpo);
      window.open(url, "_blank", "noopener");
    });
    el("prFilaEnviado").addEventListener("click", async function () {
      this.disabled = true;
      if (atual.id) {
        var r = await window.banco.from("marcas").update({ ultimo_contato: Admin.hojeISO() }).eq("id", atual.id);
        if (r.error) { window.alert("Não consegui marcar como enviada: " + r.error.message); this.disabled = false; return; }
        marcas.forEach(function (m) { if (m.id === atual.id) m.ultimo_contato = Admin.hojeISO(); });
      }
      fila.shift();
      desenharFila();
    });
    el("prFilaPular").addEventListener("click", function () {
      fila.push(fila.shift());
      desenharFila();
    });
  }

  // ---------------------------------------------------------
  // Descadastro e histórico
  // ---------------------------------------------------------

  function desenharOptout() {
    var area = el("prListaOptout");
    if (!tabelaOptoutOk) { area.textContent = "A tabela email_optout ainda não existe (rode o disparo.sql)."; return; }
    if (optouts.length === 0) { area.textContent = "Ninguém pediu pra sair até agora."; return; }
    area.innerHTML = optouts.map(function (o) { return "<div>" + esc(o.email) + "</div>"; }).join("");
  }

  async function adicionarOptout() {
    var campo = el("prOptoutEmail");
    var email = campo.value.trim().toLowerCase();
    if (!emailValido(email)) { window.alert("Digite um e-mail válido."); return; }
    if (!tabelaOptoutOk) { window.alert("Falta criar a tabela email_optout. Rode o disparo.sql no Supabase."); return; }
    var r = await window.banco.from("email_optout").upsert({ email: email }, { onConflict: "email" });
    if (r.error) { window.alert("Não consegui adicionar: " + r.error.message); return; }
    campo.value = "";
    await carregarDados();
    atualizarTudo();
  }

  function formatarQuando(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function desenharHistorico() {
    var corpo = el("prCorpoHistorico");
    if (!tabelaEnviosOk) {
      corpo.innerHTML = '<tr><td colspan="4"><p class="texto-vazio">O histórico ainda não existe: falta criar a tabela email_envios (arquivo disparo.sql).</p></td></tr>';
      return;
    }
    var termo = el("prBuscaHistorico").value.trim().toLowerCase();
    var linhas = envios.filter(function (l) { return !termo || (l.email || "").toLowerCase().indexOf(termo) !== -1; });
    if (linhas.length === 0) {
      corpo.innerHTML = '<tr><td colspan="4"><p class="texto-vazio">' + (termo ? "Nenhum envio encontrado para essa busca." : "Nenhum e-mail enviado ainda.") + "</p></td></tr>";
      return;
    }
    corpo.innerHTML = linhas.slice(0, 300).map(function (l) {
      var ok = l.status === "ok";
      return "<tr><td>" + esc(l.email) + "</td><td>" + esc(l.assunto) + "</td><td>" + esc(formatarQuando(l.criado_em)) + "</td>" +
        '<td><span class="pilula" style="color:' + (ok ? "var(--ok)" : "var(--erro)") + '">' + (ok ? "Enviado" : "Erro") + "</span>" +
        (ok ? "" : ' <span style="font-size:0.74rem; color:var(--erro);">' + esc(l.erro || "") + "</span>") + "</td></tr>";
    }).join("");
  }

  // ---------------------------------------------------------
  // Montagem geral
  // ---------------------------------------------------------

  function atualizarTudo() {
    atualizarNumeros();
    mostrarOuEsconderCorpo();
    montarOpcoesPublico();
    atualizarContagem();
    atualizarPrevia();
    desenharOptout();
    desenharHistorico();
  }

  function definirMetodo(novo) {
    metodo = novo;
    document.querySelectorAll("#prMetodos .filtro-pilula-botao").forEach(function (b) {
      b.classList.toggle("ativo", b.getAttribute("data-metodo") === novo);
    });
    el("prPainelResend").hidden = novo !== "resend";
    el("prPainelRascunho").hidden = novo !== "rascunho";
  }

  function configurarEventosUmaVez() {
    if (jaConfigurado) return;
    jaConfigurado = true;

    carregarLocal();

    ["prAssunto", "prTexto", "prBotaoTexto", "prBotaoLink", "prHtml"].forEach(function (id) {
      el(id).addEventListener("input", aoMudarConteudo);
    });

    el("prModosEscrita").addEventListener("click", function (ev) {
      var b = ev.target.closest(".filtro-pilula-botao");
      if (b) definirModoEscrita(b.getAttribute("data-modo"));
    });
    el("prMetodos").addEventListener("click", function (ev) {
      var b = ev.target.closest(".filtro-pilula-botao");
      if (b) definirMetodo(b.getAttribute("data-metodo"));
    });

    el("prModeloPronto").addEventListener("click", function () {
      var campo = el("prHtml");
      if (campo.value.trim() && !window.confirm("Isso substitui o HTML que está aí pelo modelo pronto, montado com o seu texto do Modo fácil. Continuar?")) return;
      campo.value = montarHtmlFacil(el("prTexto").value, el("prBotaoTexto").value, el("prBotaoLink").value);
      aoMudarConteudo();
    });

    el("prPublico").addEventListener("change", atualizarContagem);
    el("prTelaCheia").addEventListener("click", abrirTelaCheia);
    el("prBotaoTeste").addEventListener("click", enviarTeste);
    el("prBotaoDisparar").addEventListener("click", pedirConfirmacao);
    el("prConfirmarSim").addEventListener("click", executarDisparo);
    el("prLimparSelecaoSim").addEventListener("click", limparSelecaoAgora);
    el("prMontarFila").addEventListener("click", montarFila);
    el("prOptoutAdicionar").addEventListener("click", adicionarOptout);
    el("prBuscaHistorico").addEventListener("input", desenharHistorico);

    function irParaMarcas() { Admin.mostrarSecao("marcas"); }
    el("prIrParaMarcasVazio").addEventListener("click", irParaMarcas);
    el("prIrParaMarcasSelecao").addEventListener("click", irParaMarcas);
  }

  window.AdminProspeccao = {
    abrir: async function () {
      configurarEventosUmaVez();
      try {
        await carregarDados();
      } catch (e) {
        Admin.mostrarAviso("avisosProspeccao", "Não consegui carregar os dados agora: " + (e && e.message ? e.message : e), "erro");
      }
      atualizarTudo();
    }
  };
})();
