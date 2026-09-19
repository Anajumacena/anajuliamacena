/*
  Aba Checklist: usa o conteúdo de js/biblioteca.js (window.Biblioteca)
  exatamente como ele vem, sem reescrever nada. Só o que a Ana Julia
  marca como feito é salvo (na tabela "marcados"), o resto é só
  leitura do arquivo.
*/

(function () {
  "use strict";

  var marcadosCache = {};
  var jaConfigurado = false;

  function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- Sub-aba 1: Checklist do portfólio ----------

  function renderizarChecklist() {
    if (!window.Biblioteca || !Biblioteca.CHECKLIST) return;
    var container = document.getElementById("listaSecoesChecklist");
    var html = "";
    Biblioteca.CHECKLIST.forEach(function (secao, indiceSecao) {
      var itens = secao.itens || [];
      var marcadosSecao = 0;
      var corpoItens = "";
      itens.forEach(function (item, indiceItem) {
        var chave = secao.id + "-" + indiceItem;
        var marcado = !!marcadosCache[chave];
        if (marcado) marcadosSecao++;
        corpoItens += '<div class="item-checklist' + (marcado ? " marcado" : "") + '">' +
          '<input type="checkbox" data-chave="' + chave + '" ' + (marcado ? "checked" : "") + ">" +
          '<div><div class="titulo-item">' + Admin.escapeHtml(item.t) + '</div><div class="descricao-item">' + Admin.escapeHtml(item.d) + "</div></div></div>";
      });
      html += '<div class="secao-checklist" data-secao-indice="' + indiceSecao + '">' +
        '<div class="cabecalho-secao-checklist" data-toggle-secao="' + indiceSecao + '">' +
        '<span class="emoji">' + (secao.emoji || "") + "</span>" +
        '<div class="info-secao"><div class="nome-secao">' + Admin.escapeHtml(secao.nome) + '</div><div class="resumo-secao">' + Admin.escapeHtml(secao.resumo) + "</div></div>" +
        '<span class="progresso-secao">' + marcadosSecao + "/" + itens.length + "</span></div>" +
        '<div class="corpo-secao-checklist" hidden><p class="porque-secao">' + Admin.escapeHtml(secao.porque) + "</p>" + corpoItens + "</div></div>";
    });
    container.innerHTML = html;
    atualizarProgressoLocal();
  }

  function atualizarProgressoLocal() {
    if (!window.Biblioteca || !Biblioteca.CHECKLIST) return;
    var totalItens = 0, totalMarcados = 0;
    document.querySelectorAll(".secao-checklist[data-secao-indice]").forEach(function (secaoEl) {
      var indiceSecao = Number(secaoEl.getAttribute("data-secao-indice"));
      var secao = Biblioteca.CHECKLIST[indiceSecao];
      var itens = secao.itens || [];
      var marcadosSecao = 0;
      itens.forEach(function (item, indiceItem) {
        if (marcadosCache[secao.id + "-" + indiceItem]) marcadosSecao++;
      });
      var rotulo = secaoEl.querySelector(".progresso-secao");
      if (rotulo) rotulo.textContent = marcadosSecao + "/" + itens.length;
      totalItens += itens.length;
      totalMarcados += marcadosSecao;
    });
    document.querySelectorAll('#listaSecoesChecklist input[type="checkbox"][data-chave]').forEach(function (cb) {
      var wrapper = cb.closest(".item-checklist");
      if (wrapper) wrapper.classList.toggle("marcado", cb.checked);
    });
    var pct = totalItens ? Math.round((totalMarcados / totalItens) * 100) : 0;
    document.getElementById("rotuloProgressoGeral").textContent = pct + "%";
    document.getElementById("barraProgressoGeral").style.width = pct + "%";
  }

  // ---------- Sub-aba 2: Referências de vídeo ----------

  function renderizarReferencias() {
    if (!window.Biblioteca || !Biblioteca.REFERENCIAS) return;
    var container = document.getElementById("grideReferencias");
    var html = "";
    Biblioteca.REFERENCIAS.forEach(function (ref, indice) {
      html += '<div class="card-referencia" data-ref-indice="' + indice + '">' +
        '<div class="capa-referencia">' + (ref.emoji || "🎬") + "</div>" +
        '<div class="info-referencia"><div class="titulo-referencia">' + Admin.escapeHtml(ref.titulo) + '</div><div class="meta-referencia">' +
        Admin.escapeHtml(ref.estilo) + " · " + Admin.escapeHtml(ref.duracao) + (ref.marca ? " · " + Admin.escapeHtml(ref.marca) : "") + "</div></div></div>";
    });
    container.innerHTML = html;
  }

  function abrirFichaReferencia(ref) {
    document.getElementById("tituloModalReferencia").textContent = ref.titulo;
    var roteiroHtml = "";
    (ref.roteiro || []).forEach(function (bloco) {
      roteiroHtml += '<div class="bloco-roteiro"><span class="tempo-roteiro">' + Admin.escapeHtml(bloco.t) + "</span>" + bloco.o + "</div>";
    });
    var html =
      "<p style=\"margin-bottom:12px;\"><b>Gancho:</b> " + Admin.escapeHtml(ref.gancho) + "</p>" +
      "<p style=\"margin-bottom:12px;\"><b>Por que funciona:</b> " + Admin.escapeHtml(ref.porque) + "</p>" +
      "<p style=\"margin-bottom:12px;\"><b>Diferencial:</b> " + Admin.escapeHtml(ref.diferencial) + "</p>" +
      "<p style=\"margin-bottom:16px;\"><b>Erro comum:</b> " + Admin.escapeHtml(ref.erro) + "</p>" +
      '<h3 style="font-size:0.85rem; text-transform:uppercase; margin-bottom:10px;">Roteiro em blocos</h3>' + roteiroHtml +
      (ref.youtube ? '<div style="margin-top:16px;"><a class="botao principal" href="' + ref.youtube + '" target="_blank" rel="noopener noreferrer">Assistir no YouTube</a></div>' : "");
    document.getElementById("corpoModalReferencia").innerHTML = html;
    Admin.abrirModal("modalReferencia");
  }

  // ---------- Sub-aba 3: Roteiros (TIPOS) ----------

  function renderizarTipos() {
    if (!window.Biblioteca || !Biblioteca.TIPOS) return;
    var container = document.getElementById("listaTipos");
    var html = "";
    Biblioteca.TIPOS.forEach(function (tipo, indice) {
      var beatsHtml = "";
      (tipo.beats || []).forEach(function (b) {
        beatsHtml += '<div class="bloco-roteiro"><span class="tempo-roteiro">' + Admin.escapeHtml(b.t) + "</span>" + b.o + "</div>";
      });
      var errosHtml = "";
      if (tipo.erros && tipo.erros.length) {
        errosHtml = '<p style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--texto-suave); margin:14px 0 6px;">Erros comuns</p><ul class="lista-simples">';
        tipo.erros.forEach(function (e) { errosHtml += "<li><span>" + Admin.escapeHtml(e) + "</span></li>"; });
        errosHtml += "</ul>";
      }
      html += '<div class="tipo-roteiro-item"><div class="tipo-roteiro-cabecalho" data-toggle-tipo="' + indice + '">' +
        '<span class="emoji">' + (tipo.emoji || "") + '</span><div style="flex:1;"><div class="nome-secao">' + Admin.escapeHtml(tipo.nome) +
        '</div><div class="resumo-secao">' + Admin.escapeHtml(tipo.duracao || "") + "</div></div></div>" +
        '<div class="tipo-roteiro-corpo" hidden><p class="porque-secao">' + Admin.escapeHtml(tipo.porque) + "</p>" + beatsHtml + errosHtml + "</div></div>";
    });
    container.innerHTML = html;
  }

  // ---------- Sub-aba 4: Ideias por nicho ----------

  function renderizarNichos() {
    if (!window.Biblioteca || !Biblioteca.NICHOS) return;
    var container = document.getElementById("listaNichos");
    var html = "";
    Biblioteca.NICHOS.forEach(function (nicho) {
      html += '<div class="nicho-ideias-card"><h3>' + (nicho.emoji || "") + " " + Admin.escapeHtml(nicho.nome) + "</h3>";
      (nicho.ideias || []).forEach(function (ideia) {
        html += '<div class="ideia-item"><div>' + Admin.escapeHtml(ideia.t) + '</div><div class="gancho-ideia">' + Admin.escapeHtml(ideia.gancho) + "</div></div>";
      });
      html += "</div>";
    });
    container.innerHTML = html;
  }

  // ---------- Sub-aba 5: Revisar meu roteiro ----------

  function renderizarRevisao() {
    if (!window.Biblioteca || !Biblioteca.REVISAO) return;
    var container = document.getElementById("listaRevisao");
    var html = "";
    Biblioteca.REVISAO.forEach(function (bloco, indiceBloco) {
      html += '<div class="secao-checklist"><div class="cabecalho-secao-checklist" style="cursor:default;"><span class="emoji">' + (bloco.emoji || "") +
        '</span><div class="info-secao"><div class="nome-secao">' + Admin.escapeHtml(bloco.bloco) + "</div></div></div>" +
        '<div class="corpo-secao-checklist">';
      (bloco.itens || []).forEach(function (item, indiceItem) {
        html += '<div class="item-checklist"><input type="checkbox" data-revisao="' + indiceBloco + "-" + indiceItem + '">' +
          '<div><div class="titulo-item">' + Admin.escapeHtml(item.t) + '</div><div class="descricao-item">' + Admin.escapeHtml(item.d) + "</div></div></div>";
      });
      html += "</div></div>";
    });
    container.innerHTML = html;
  }

  // ---------- Carregar o que já foi marcado ----------

  async function carregarMarcados() {
    Admin.limparAvisos("avisosChecklist");
    if (!window.Biblioteca) {
      Admin.mostrarAviso("avisosChecklist", 'Não encontrei o conteúdo do checklist (js/biblioteca.js). Confira se o arquivo foi salvo no projeto.', "erro");
      return;
    }
    var resposta = await window.banco.from("marcados").select("*");
    marcadosCache = {};
    if (resposta.error) {
      if (Admin.ehErroDeEstrutura(resposta.error)) Admin.avisoDeEstrutura("avisosChecklist", "marcados");
      else Admin.mostrarAviso("avisosChecklist", "Não consegui carregar o que você já marcou. As marcações desta visita podem não salvar.", "erro");
    } else {
      (resposta.data || []).forEach(function (linha) { marcadosCache[linha.chave] = linha.marcado; });
    }
  }

  function configurarEventosUmaVez() {
    if (jaConfigurado) return;
    jaConfigurado = true;

    document.querySelectorAll(".subaba-botao").forEach(function (botao) {
      botao.addEventListener("click", function () {
        var alvo = botao.getAttribute("data-subaba");
        document.querySelectorAll(".subaba-botao").forEach(function (b) { b.classList.remove("ativo"); });
        botao.classList.add("ativo");
        ["checklist", "referencias", "roteiros", "ideias", "revisar"].forEach(function (nome) {
          document.getElementById("subaba" + capitalizar(nome)).hidden = nome !== alvo;
        });
      });
    });

    document.getElementById("listaSecoesChecklist").addEventListener("click", function (evento) {
      var cabecalho = evento.target.closest("[data-toggle-secao]");
      if (!cabecalho) return;
      var corpo = cabecalho.nextElementSibling;
      corpo.hidden = !corpo.hidden;
    });

    document.getElementById("listaSecoesChecklist").addEventListener("change", async function (evento) {
      var checkbox = evento.target.closest('input[type="checkbox"][data-chave]');
      if (!checkbox) return;
      var chave = checkbox.getAttribute("data-chave");
      marcadosCache[chave] = checkbox.checked;
      atualizarProgressoLocal();
      var resultado = await window.banco.from("marcados").upsert({ chave: chave, marcado: checkbox.checked, atualizado_em: new Date().toISOString() });
      if (resultado.error) {
        Admin.mostrarAviso("avisosChecklist", "Não consegui salvar essa marcação agora.", "erro");
      }
    });

    document.getElementById("grideReferencias").addEventListener("click", function (evento) {
      var card = evento.target.closest("[data-ref-indice]");
      if (!card) return;
      abrirFichaReferencia(Biblioteca.REFERENCIAS[Number(card.getAttribute("data-ref-indice"))]);
    });

    document.getElementById("listaTipos").addEventListener("click", function (evento) {
      var cabecalho = evento.target.closest("[data-toggle-tipo]");
      if (!cabecalho) return;
      var corpo = cabecalho.nextElementSibling;
      corpo.hidden = !corpo.hidden;
    });

    document.getElementById("listaRevisao").addEventListener("change", function (evento) {
      var cb = evento.target.closest("input[data-revisao]");
      if (!cb) return;
      var item = cb.closest(".item-checklist");
      if (item) item.classList.toggle("marcado", cb.checked);
    });
  }

  window.AdminChecklist = {
    abrir: function () {
      configurarEventosUmaVez();
      carregarMarcados().then(function () {
        renderizarChecklist();
        renderizarReferencias();
        renderizarTipos();
        renderizarNichos();
        renderizarRevisao();
      });
    }
  };
})();
