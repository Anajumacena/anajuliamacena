/*
  Núcleo do painel: confere a sessão antes de mostrar qualquer
  coisa, monta o menu, controla os modais e guarda funções que
  as outras abas (portfolio, marcas, calendario, campanhas,
  checklist) usam em comum.

  Se um dia faltar uma tabela ou uma coluna no banco, as funções
  daqui detectam isso e cada aba mostra um aviso em vez de
  travar a página inteira.
*/

window.Admin = {};

(function () {
  "use strict";

  var MAPA_SECOES = {
    portfolio:  { id: "secaoPortfolio",  titulo: "Portfólio" },
    marcas:     { id: "secaoMarcas",     titulo: "Marcas" },
    calendario: { id: "secaoCalendario", titulo: "Calendário" },
    campanhas:  { id: "secaoCampanhas",  titulo: "Campanhas" },
    checklist:  { id: "secaoChecklist",  titulo: "Checklist do portfólio" }
  };

  // ---------------------------------------------------------
  // Utilidades gerais, usadas por todas as abas
  // ---------------------------------------------------------

  Admin.escapeHtml = function (valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  Admin.formatarDataBR = function (iso) {
    if (!iso) return "";
    var partes = String(iso).slice(0, 10).split("-");
    if (partes.length !== 3) return iso;
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  };

  Admin.formatarMoeda = function (valor) {
    var n = Number(valor) || 0;
    return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  Admin.hojeISO = function () {
    var d = new Date();
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  };

  Admin.diasEntre = function (deISO, paraISO) {
    var de = new Date(String(deISO).slice(0, 10) + "T00:00:00");
    var para = new Date(String(paraISO).slice(0, 10) + "T00:00:00");
    return Math.round((para - de) / 86400000);
  };

  // Detecta se um erro do Supabase é porque uma tabela ou coluna
  // esperada não existe no banco (em vez de travar, cada aba usa
  // isso pra mostrar um aviso e continuar funcionando no resto).
  Admin.ehErroDeEstrutura = function (erro) {
    if (!erro) return false;
    var textoErro = ((erro.message || "") + " " + (erro.details || "") + " " + (erro.hint || "")).toLowerCase();
    var codigosConhecidos = ["42p01", "42703", "pgrst205", "pgrst204", "pgrst202"];
    if (erro.code && codigosConhecidos.indexOf(String(erro.code).toLowerCase()) !== -1) return true;
    return textoErro.indexOf("schema cache") !== -1 || textoErro.indexOf("does not exist") !== -1;
  };

  Admin.limparAvisos = function (idContainer) {
    var el = document.getElementById(idContainer);
    if (el) el.innerHTML = "";
  };

  Admin.mostrarAviso = function (idContainer, mensagem, tipo) {
    var el = document.getElementById(idContainer);
    if (!el) return;
    var classe = tipo === "erro" ? "erro-caixa" : (tipo === "ok" ? "ok-caixa" : "aviso-caixa");
    var div = document.createElement("div");
    div.className = classe;
    div.textContent = mensagem;
    el.appendChild(div);
    if (tipo === "ok") {
      setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 3500);
    }
  };

  // Gera um arquivo CSV e baixa no navegador. Usa ponto e vírgula
  // como separador e um sinal invisível (BOM) no começo do
  // arquivo, que é o que faz o Excel brasileiro abrir com os
  // acentos certos em vez de vir tudo embaralhado.
  Admin.baixarCSV = function (nomeArquivo, colunas, linhas) {
    function protegerCampo(valor) {
      var texto = valor === null || valor === undefined ? "" : String(valor);
      texto = texto.replace(/"/g, '""');
      return '"' + texto + '"';
    }
    var conteudo = colunas.map(protegerCampo).join(";") + "\r\n";
    linhas.forEach(function (linha) {
      conteudo += linha.map(protegerCampo).join(";") + "\r\n";
    });
    var bom = "﻿";
    var blob = new Blob([bom + conteudo], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  Admin.avisoDeEstrutura = function (idContainer, nomeTabela) {
    Admin.mostrarAviso(
      idContainer,
      'Não encontrei a tabela ou um campo esperado em "' + nomeTabela + '" no banco de dados. Confira se o banco.sql foi colado certinho no Supabase. O resto do painel continua funcionando.',
      "aviso"
    );
  };

  // ---------------------------------------------------------
  // Modais
  // ---------------------------------------------------------

  Admin.abrirModal = function (id) {
    var modal = document.getElementById(id);
    if (modal) modal.hidden = false;
  };

  Admin.fecharModal = function (id) {
    var modal = document.getElementById(id);
    if (modal) modal.hidden = true;
  };

  function configurarModais() {
    document.querySelectorAll("[data-fechar]").forEach(function (botao) {
      botao.addEventListener("click", function () {
        Admin.fecharModal(botao.getAttribute("data-fechar"));
      });
    });
    document.querySelectorAll(".fundo-modal").forEach(function (fundo) {
      fundo.addEventListener("click", function (evento) {
        if (evento.target === fundo) fundo.hidden = true;
      });
    });
    document.addEventListener("keydown", function (evento) {
      if (evento.key !== "Escape") return;
      document.querySelectorAll(".fundo-modal").forEach(function (fundo) {
        if (!fundo.hidden) fundo.hidden = true;
      });
    });
  }

  // ---------------------------------------------------------
  // Navegação entre abas
  // ---------------------------------------------------------

  var jaAbriu = {};

  Admin.mostrarSecao = function (nome) {
    var info = MAPA_SECOES[nome];
    if (!info) return;

    Object.keys(MAPA_SECOES).forEach(function (chave) {
      var secaoEl = document.getElementById(MAPA_SECOES[chave].id);
      if (secaoEl) secaoEl.hidden = chave !== nome;
    });

    document.querySelectorAll(".item-nav").forEach(function (botao) {
      botao.classList.toggle("ativo", botao.getAttribute("data-secao") === nome);
    });

    document.getElementById("tituloSecao").textContent = info.titulo;
    document.body.classList.remove("menu-aberto");

    var nomeModulo = "Admin" + nome.charAt(0).toUpperCase() + nome.slice(1);
    if (window[nomeModulo] && typeof window[nomeModulo].abrir === "function") {
      window[nomeModulo].abrir();
    }
    jaAbriu[nome] = true;
  };

  function configurarNavegacao() {
    document.querySelectorAll(".item-nav").forEach(function (botao) {
      botao.addEventListener("click", function () {
        Admin.mostrarSecao(botao.getAttribute("data-secao"));
      });
    });
  }

  function configurarMenuMobile() {
    var botao = document.getElementById("botaoMenuMobile");
    var fundo = document.getElementById("fundoDrawer");
    function alternar() {
      var aberto = document.body.classList.toggle("menu-aberto");
      botao.setAttribute("aria-expanded", aberto ? "true" : "false");
    }
    botao.addEventListener("click", alternar);
    fundo.addEventListener("click", function () { document.body.classList.remove("menu-aberto"); });
  }

  // ---------------------------------------------------------
  // Sessão: a primeira coisa a rodar
  // ---------------------------------------------------------

  async function iniciar() {
    if (!window.banco) {
      document.getElementById("telaCarregando").textContent =
        "Não consegui carregar o sistema agora. Recarregue a página em alguns instantes.";
      return;
    }

    var resposta;
    try {
      resposta = await window.banco.auth.getSession();
    } catch (erro) {
      document.getElementById("telaCarregando").textContent =
        "Não consegui falar com o servidor agora. Recarregue a página.";
      return;
    }

    if (!resposta.data || !resposta.data.session) {
      window.location.href = "../login/";
      return;
    }

    document.getElementById("emailUsuario").textContent = resposta.data.session.user.email || "";
    document.body.classList.remove("carregando");

    configurarModais();
    configurarNavegacao();
    configurarMenuMobile();

    document.getElementById("botaoSair").addEventListener("click", async function () {
      await window.banco.auth.signOut();
      window.location.href = "../login/";
    });

    window.banco.auth.onAuthStateChange(function (evento, sessao) {
      if (!sessao) window.location.href = "../login/";
    });

    Admin.mostrarSecao("portfolio");
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
