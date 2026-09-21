/*
  Aba Portfólio: números do site, gráfico de visitas e a lista
  de vídeos (adicionar, editar, apagar, mostrar/esconder e
  arrastar pra mudar a ordem).
*/

(function () {
  "use strict";

  var ICONE_ARRASTAR = '<svg class="icone" viewBox="0 0 24 24"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>';
  var ICONE_OLHO = '<svg class="icone" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICONE_OLHO_FECHADO = '<svg class="icone" viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6 0 10 7 10 7a17.9 17.9 0 0 1-3.2 3.9M6.6 6.6C4 8.3 2 12 2 12s4 7 10 7a10.4 10.4 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  var ICONE_LAPIS = '<svg class="icone" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICONE_LIXO = '<svg class="icone" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

  var videosCache = [];
  var jaConfigurado = false;

  // Os vídeos que já estavam fixos no código do portfólio antes de
  // ele passar a ler do banco. O botão "Importar vídeos anteriores"
  // manda essa lista pro banco de uma vez só, pra você não ter que
  // digitar tudo de novo à mão.
  var VIDEOS_ANTERIORES = [
    { titulo: "Rotina de make no dia a dia", nicho: "beleza", formato: "Vídeo vertical 9:16", link: "#" },
    { titulo: "Resenha de batom", nicho: "beleza", formato: "Foto still 4:5", link: "#" },
    { titulo: "Rotina de skincare noturna", nicho: "skincare", formato: "Vídeo vertical 9:16", link: "#" },
    { titulo: "Antes e depois com sérum", nicho: "skincare", formato: "Foto still 4:5", link: "#" },
    { titulo: "Look do dia", nicho: "moda", formato: "Foto still 4:5", link: "#" },
    { titulo: "Try on de acessórios", nicho: "moda", formato: "Vídeo vertical 9:16", link: "#" },
    { titulo: "Treino em casa com peso corporal", nicho: "fitness", formato: "Vídeo vertical 9:16", link: "#" },
    { titulo: "Look fitness para academia", nicho: "fitness", formato: "Foto still 4:5", link: "#" },
    { titulo: "Valência", nicho: "viagem", formato: "Vídeo vertical 9:16", link: "https://youtube.com/shorts/wMn6O12js9I?feature=share" },
    { titulo: "Córdoba", nicho: "viagem", formato: "Vídeo vertical 9:16", link: "https://youtube.com/shorts/GtXovgaC9F8?feature=share" },
    { titulo: "Sevilha", nicho: "viagem", formato: "Vídeo vertical 9:16", link: "https://youtube.com/shorts/OPtVSOvBZNI" },
    { titulo: "Itália", nicho: "viagem", formato: "Vídeo vertical 9:16", link: "https://youtube.com/shorts/wBNowcZuBQY?feature=share" },
    { titulo: "Turquia", nicho: "viagem", formato: "Vídeo vertical 9:16", link: "#" },
    { titulo: "Color WoW", nicho: "marcas", formato: "Vídeo vertical 9:16", link: "https://youtube.com/shorts/0s6vv8fqXT0?feature=share" },
    { titulo: "Bohems Coffee - Turquia", nicho: "marcas", formato: "Vídeo vertical 9:16", link: "https://youtube.com/shorts/vgkxZ5Mznds?feature=share" },
    { titulo: "My sht - Barcelona", nicho: "marcas", formato: "Vídeo vertical 9:16", link: "https://youtube.com/shorts/FQgOZoKCaa8?feature=share" },
    { titulo: "Cloud Tattoo - Barcelona", nicho: "marcas", formato: "Vídeo vertical 9:16", link: "#" }
  ];

  // Fotos de viagem da faixa "Entre Olhares", já hospedadas dentro do
  // próprio site (pasta imagens/entre-olhares). O botão "Importar
  // fotos Entre Olhares" manda essa lista pro banco de uma vez.
  var FOTOS_ENTRE_OLHARES = [
    { titulo: "Istambul, Turquia", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/01-istambul-turquia.jpg" },
    { titulo: "Sitges, Espanha", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/02-sitges-espanha.jpg" },
    { titulo: "Sitges ao entardecer", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/03-sitges-entardecer.jpg" },
    { titulo: "Mirante em Sitges", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/04-mirante-sitges.jpg" },
    { titulo: "Manarola, Itália", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/05-manarola-italia.jpg" },
    { titulo: "Enseada na Turquia", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/06-enseada-turquia.jpg" },
    { titulo: "Madri, Espanha", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/07-madri-espanha.jpg" },
    { titulo: "Sevilha, Espanha", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/08-sevilha-espanha.jpg" },
    { titulo: "Alhambra, Granada", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/09-alhambra-granada.jpg" },
    { titulo: "Rio Guadalquivir, Sevilha", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/10-rio-guadalquivir-sevilha.jpg" },
    { titulo: "Ruas de Sitges", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/11-ruas-sitges.jpg" },
    { titulo: "Coliseu, Roma", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/12-coliseu-roma.jpg" },
    { titulo: "Capadócia ao amanhecer", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/13-capadocia-amanhecer.jpg" },
    { titulo: "Formações da Capadócia", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/14-formacoes-capadocia.jpg" },
    { titulo: "Capadócia, Turquia", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/15-capadocia-turquia.jpg" },
    { titulo: "Vale da Capadócia", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/16-vale-capadocia.jpg" },
    { titulo: "Parque em Istambul", link: "https://anajumacena.github.io/anajuliamacena/imagens/entre-olhares/17-parque-istambul.jpg" }
  ];

  function itemStat(valor, rotulo) {
    return '<div class="stat-item"><span class="stat-valor">' + Admin.escapeHtml(valor) + '</span><span class="stat-rotulo">' + rotulo + "</span></div>";
  }

  function renderizarFaixaStats(s) {
    document.getElementById("faixaStatsPortfolio").innerHTML =
      itemStat(s.visitas14, "Visitas em 14 dias") +
      itemStat(s.visitasHoje, "Visitas hoje") +
      itemStat(s.videosNoAr, "Vídeos no ar") +
      itemStat(s.nichoForte, "Nicho mais forte") +
      itemStat(s.origemForte, "De onde mais vêm");
  }

  function renderizarGrafico(visitas14) {
    var container = document.getElementById("areaGraficoVisitas");
    if (visitas14.length === 0) {
      container.innerHTML = '<p class="texto-vazio">Ainda não há visitas registradas. Assim que as pessoas começarem a visitar o seu portfólio, esse gráfico aparece aqui sozinho.</p>';
      return;
    }
    var dias = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      dias.push({ iso: iso, rotulo: String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"), contagem: 0 });
    }
    visitas14.forEach(function (v) {
      var iso = String(v.data).slice(0, 10);
      for (var j = 0; j < dias.length; j++) {
        if (dias[j].iso === iso) { dias[j].contagem++; break; }
      }
    });
    var maximo = 0;
    dias.forEach(function (d) { if (d.contagem > maximo) maximo = d.contagem; });
    var hoje = Admin.hojeISO();
    var html = '<div class="grafico-barras">';
    dias.forEach(function (d) {
      var alturaPct = maximo > 0 ? Math.round((d.contagem / maximo) * 100) : 0;
      if (d.contagem > 0 && alturaPct < 6) alturaPct = 6;
      html += '<div class="barra-dia' + (d.iso === hoje ? " hoje" : "") + '" title="' + d.contagem + " visita(s) em " + d.rotulo + '">' +
        '<div class="barra" style="height:' + alturaPct + '%"></div>' +
        '<span class="rotulo-barra">' + d.rotulo + "</span></div>";
    });
    html += "</div>";
    container.innerHTML = html;
  }

  function renderizarOrigens(contagemOrigem, total) {
    var container = document.getElementById("areaOrigemVisitas");
    var chaves = Object.keys(contagemOrigem);
    if (chaves.length === 0) {
      container.innerHTML = '<p class="texto-vazio">Ainda não há de onde mostrar. Essa lista se preenche conforme as visitas chegarem.</p>';
      return;
    }
    chaves.sort(function (a, b) { return contagemOrigem[b] - contagemOrigem[a]; });
    var html = '<ul class="lista-simples">';
    chaves.forEach(function (o) {
      var pct = total > 0 ? Math.round((contagemOrigem[o] / total) * 100) : 0;
      html += "<li><span>" + Admin.escapeHtml(o) + "</span><span>" + contagemOrigem[o] + " (" + pct + "%)</span></li>";
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  function renderizarTabelaVideos(videos) {
    var corpo = document.getElementById("corpoTabelaVideos");
    if (videos.length === 0) {
      corpo.innerHTML = '<tr><td colspan="6"><p class="texto-vazio">Nenhum vídeo cadastrado ainda. Clique em "Adicionar vídeo" pra começar.</p></td></tr>';
      return;
    }
    corpo.innerHTML = "";
    videos.forEach(function (v) {
      var tr = document.createElement("tr");
      tr.className = "linha-arrastavel";
      tr.draggable = true;
      tr.dataset.id = v.id;
      tr.innerHTML =
        '<td class="alca-arraste">' + ICONE_ARRASTAR + "</td>" +
        "<td>" + Admin.escapeHtml(v.titulo) + (v.visivel ? "" : ' <span class="stat-sub">(escondido)</span>') + "</td>" +
        "<td>" + Admin.escapeHtml(v.nicho) + "</td>" +
        "<td>" + Admin.escapeHtml(v.marca || "-") + "</td>" +
        "<td>" + Admin.escapeHtml(v.destaque || "-") + "</td>" +
        '<td><button class="botao-icone" data-acao="visibilidade" title="' + (v.visivel ? "Esconder do site" : "Mostrar no site") + '">' + (v.visivel ? ICONE_OLHO : ICONE_OLHO_FECHADO) + "</button> " +
        '<button class="botao-icone" data-acao="editar" title="Editar">' + ICONE_LAPIS + "</button> " +
        '<button class="botao-icone" data-acao="excluir" title="Apagar">' + ICONE_LIXO + "</button></td>";
      corpo.appendChild(tr);
    });
    configurarArrastarSoltar(corpo);
  }

  function configurarArrastarSoltar(corpo) {
    var linhaArrastada = null;
    corpo.querySelectorAll("tr.linha-arrastavel").forEach(function (tr) {
      tr.addEventListener("dragstart", function () {
        linhaArrastada = tr;
        tr.classList.add("arrastando");
      });
      tr.addEventListener("dragend", function () {
        tr.classList.remove("arrastando");
        linhaArrastada = null;
        salvarNovaOrdem(corpo);
      });
      tr.addEventListener("dragover", function (evento) {
        evento.preventDefault();
        if (tr === linhaArrastada || !linhaArrastada) return;
        var retangulo = tr.getBoundingClientRect();
        var depois = (evento.clientY - retangulo.top) / retangulo.height > 0.5;
        corpo.insertBefore(linhaArrastada, depois ? tr.nextSibling : tr);
      });
    });
  }

  async function salvarNovaOrdem(corpo) {
    var linhas = Array.prototype.slice.call(corpo.querySelectorAll("tr.linha-arrastavel"));
    var pedidos = linhas.map(function (tr, indice) {
      return window.banco.from("videos").update({ ordem: indice }).eq("id", tr.dataset.id);
    });
    await Promise.all(pedidos);
  }

  function abrirModalNovo() {
    document.getElementById("tituloModalVideo").textContent = "Adicionar vídeo";
    document.getElementById("formVideo").reset();
    document.getElementById("videoId").value = "";
    document.getElementById("videoVisivel").checked = true;
    Admin.abrirModal("modalVideo");
  }

  function abrirModalEdicao(video) {
    document.getElementById("tituloModalVideo").textContent = "Editar vídeo";
    document.getElementById("videoId").value = video.id;
    document.getElementById("videoTitulo").value = video.titulo || "";
    document.getElementById("videoLink").value = video.link || "";
    document.getElementById("videoNicho").value = video.nicho || "";
    document.getElementById("videoFormato").value = video.formato || "";
    document.getElementById("videoMarca").value = video.marca || "";
    document.getElementById("videoDestaque").value = video.destaque || "";
    document.getElementById("videoCapa").value = video.capa || "";
    document.getElementById("videoVisivel").checked = !!video.visivel;
    Admin.abrirModal("modalVideo");
  }

  async function excluirVideo(video) {
    if (!window.confirm('Apagar o vídeo "' + video.titulo + '"? Essa ação não pode ser desfeita.')) return;
    var resultado = await window.banco.from("videos").delete().eq("id", video.id);
    if (resultado.error) { Admin.mostrarAviso("avisosPortfolio", "Não consegui apagar o vídeo agora.", "erro"); return; }
    carregarTudo();
  }

  async function alternarVisibilidade(video) {
    var resultado = await window.banco.from("videos").update({ visivel: !video.visivel }).eq("id", video.id);
    if (resultado.error) { Admin.mostrarAviso("avisosPortfolio", "Não consegui atualizar agora.", "erro"); return; }
    carregarTudo();
  }

  async function carregarTudo() {
    Admin.limparAvisos("avisosPortfolio");

    var d14 = new Date();
    d14.setDate(d14.getDate() - 13);
    var inicio14 = d14.getFullYear() + "-" + String(d14.getMonth() + 1).padStart(2, "0") + "-" + String(d14.getDate()).padStart(2, "0") + "T00:00:00";

    var respostaVisitas = await window.banco.from("visitas").select("data, pagina, origem").gte("data", inicio14);
    var visitas14 = [];
    if (respostaVisitas.error) {
      if (Admin.ehErroDeEstrutura(respostaVisitas.error)) Admin.avisoDeEstrutura("avisosPortfolio", "visitas");
      else Admin.mostrarAviso("avisosPortfolio", "Não consegui carregar as visitas agora.", "erro");
    } else {
      visitas14 = respostaVisitas.data || [];
    }

    var respostaVideos = await window.banco.from("videos").select("*").order("ordem", { ascending: true });
    var videos = [];
    if (respostaVideos.error) {
      if (Admin.ehErroDeEstrutura(respostaVideos.error)) Admin.avisoDeEstrutura("avisosPortfolio", "videos");
      else Admin.mostrarAviso("avisosPortfolio", "Não consegui carregar os vídeos agora.", "erro");
    } else {
      videos = respostaVideos.data || [];
    }
    videosCache = videos;

    var videosNoAr = videos.filter(function (v) { return v.visivel; }).length;

    var contagemNicho = {};
    videos.filter(function (v) { return v.visivel; }).forEach(function (v) {
      var n = v.nicho || "sem nicho";
      contagemNicho[n] = (contagemNicho[n] || 0) + 1;
    });
    var nichoForte = "-", maiorNicho = 0;
    Object.keys(contagemNicho).forEach(function (n) { if (contagemNicho[n] > maiorNicho) { maiorNicho = contagemNicho[n]; nichoForte = n; } });

    var hoje = Admin.hojeISO();
    var visitasHoje = visitas14.filter(function (v) { return String(v.data).slice(0, 10) === hoje; }).length;

    var contagemOrigem = {};
    visitas14.forEach(function (v) {
      var o = v.origem || "direto";
      contagemOrigem[o] = (contagemOrigem[o] || 0) + 1;
    });
    var origemForte = "-", maiorOrigem = 0;
    Object.keys(contagemOrigem).forEach(function (o) { if (contagemOrigem[o] > maiorOrigem) { maiorOrigem = contagemOrigem[o]; origemForte = o; } });

    renderizarFaixaStats({
      visitas14: visitas14.length,
      visitasHoje: visitasHoje,
      videosNoAr: videosNoAr,
      nichoForte: nichoForte,
      origemForte: origemForte
    });
    renderizarGrafico(visitas14);
    renderizarOrigens(contagemOrigem, visitas14.length);
    renderizarTabelaVideos(videos);
  }

  async function importarVideosAnteriores() {
    var jaTemVideosReais = videosCache.some(function (v) { return v.nicho !== "exemplo"; });
    if (jaTemVideosReais) {
      var continuar = window.confirm("Já existem vídeos cadastrados. Importar de novo pode duplicar. Quer importar mesmo assim?");
      if (!continuar) return;
    } else if (!window.confirm("Isso vai adicionar os " + VIDEOS_ANTERIORES.length + " vídeos que estavam no seu portfólio antes (alguns ainda com link \"#\", pra você trocar depois). Continuar?")) {
      return;
    }

    var maiorOrdem = -1;
    videosCache.forEach(function (v) { if ((v.ordem || 0) > maiorOrdem) maiorOrdem = v.ordem || 0; });

    var linhas = VIDEOS_ANTERIORES.map(function (v, indice) {
      return {
        titulo: v.titulo,
        link: v.link,
        nicho: v.nicho,
        formato: v.formato,
        visivel: true,
        ordem: maiorOrdem + 1 + indice
      };
    });

    var resultado = await window.banco.from("videos").insert(linhas);
    if (resultado.error) {
      Admin.mostrarAviso("avisosPortfolio", "Não consegui importar os vídeos agora.", "erro");
      return;
    }
    Admin.mostrarAviso("avisosPortfolio", "Vídeos importados. Os que ainda têm link \"#\" precisam do link real, você troca clicando em editar.", "ok");
    carregarTudo();
  }

  async function importarFotosEntreOlhares() {
    // Só importa as fotos que ainda não estão no banco (compara pelo
    // link), então clicar de novo depois de eu adicionar fotos novas
    // na lista não duplica as que você já tem.
    var linksExistentes = videosCache.map(function (v) { return v.link; });
    var faltando = FOTOS_ENTRE_OLHARES.filter(function (f) { return linksExistentes.indexOf(f.link) === -1; });

    if (faltando.length === 0) {
      Admin.mostrarAviso("avisosPortfolio", "Todas as fotos dessa lista já estão cadastradas.", "ok");
      return;
    }
    if (!window.confirm("Isso vai adicionar " + faltando.length + " foto(s) nova(s) na faixa \"Entre Olhares\". Continuar?")) {
      return;
    }

    var maiorOrdem = -1;
    videosCache.forEach(function (v) { if ((v.ordem || 0) > maiorOrdem) maiorOrdem = v.ordem || 0; });

    var linhas = faltando.map(function (f, indice) {
      return {
        titulo: f.titulo,
        link: f.link,
        nicho: "Entre Olhares",
        formato: "Foto",
        visivel: true,
        ordem: maiorOrdem + 1 + indice
      };
    });

    var resultado = await window.banco.from("videos").insert(linhas);
    if (resultado.error) {
      Admin.mostrarAviso("avisosPortfolio", "Não consegui importar as fotos agora.", "erro");
      return;
    }
    Admin.mostrarAviso("avisosPortfolio", "Fotos importadas. Elas já aparecem rolando na faixa Entre Olhares do site.", "ok");
    carregarTudo();
  }

  function configurarEventosUmaVez() {
    if (jaConfigurado) return;
    jaConfigurado = true;

    document.getElementById("botaoNovoVideo").addEventListener("click", abrirModalNovo);
    document.getElementById("botaoImportarVideos").addEventListener("click", importarVideosAnteriores);
    document.getElementById("botaoImportarEntreOlhares").addEventListener("click", importarFotosEntreOlhares);

    document.getElementById("formVideo").addEventListener("submit", async function (evento) {
      evento.preventDefault();
      var id = document.getElementById("videoId").value;
      var dados = {
        titulo: document.getElementById("videoTitulo").value.trim(),
        link: document.getElementById("videoLink").value.trim(),
        nicho: document.getElementById("videoNicho").value.trim(),
        formato: document.getElementById("videoFormato").value.trim() || "Vídeo vertical 9:16",
        marca: document.getElementById("videoMarca").value.trim() || null,
        destaque: document.getElementById("videoDestaque").value.trim() || null,
        capa: document.getElementById("videoCapa").value.trim() || null,
        visivel: document.getElementById("videoVisivel").checked
      };
      var resultado;
      if (id) {
        resultado = await window.banco.from("videos").update(dados).eq("id", id);
      } else {
        var maiorOrdem = -1;
        videosCache.forEach(function (v) { if ((v.ordem || 0) > maiorOrdem) maiorOrdem = v.ordem || 0; });
        dados.ordem = maiorOrdem + 1;
        resultado = await window.banco.from("videos").insert(dados);
      }
      if (resultado.error) {
        Admin.mostrarAviso("avisosPortfolio", "Não consegui salvar o vídeo agora.", "erro");
        return;
      }
      Admin.fecharModal("modalVideo");
      carregarTudo();
    });

    document.getElementById("corpoTabelaVideos").addEventListener("click", function (evento) {
      var botao = evento.target.closest("button[data-acao]");
      if (!botao) return;
      var tr = botao.closest("tr");
      var video = videosCache.filter(function (v) { return String(v.id) === String(tr.dataset.id); })[0];
      if (!video) return;
      var acao = botao.getAttribute("data-acao");
      if (acao === "editar") abrirModalEdicao(video);
      else if (acao === "excluir") excluirVideo(video);
      else if (acao === "visibilidade") alternarVisibilidade(video);
    });
  }

  window.AdminPortfolio = {
    abrir: function () {
      configurarEventosUmaVez();
      carregarTudo();
    }
  };
})();
