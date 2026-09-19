/*
  Aba Calendário: grade do mês inteiro, com os prazos das
  campanhas aparecendo sozinhos, filtro por tipo e o bloco
  "Ficou pra trás" com o que passou do dia e não foi feito.
*/

(function () {
  "use strict";

  var NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  var DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  var calendarioCache = [];
  var campanhasCache = [];
  var anoAtual = null;
  var mesAtual = null;
  var tipoFiltro = "todos";
  var jaConfigurado = false;

  function isoDeData(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function diaSemanaSegundaPrimeiro(data) {
    return (data.getDay() + 6) % 7;
  }

  function construirCelulas(ano, mes) {
    var primeiroDia = new Date(ano, mes, 1);
    var offsetInicio = diaSemanaSegundaPrimeiro(primeiroDia);
    var inicioGrade = new Date(ano, mes, 1 - offsetInicio);
    var celulas = [];
    for (var i = 0; i < 42; i++) {
      var d = new Date(inicioGrade);
      d.setDate(inicioGrade.getDate() + i);
      celulas.push({ data: d, iso: isoDeData(d), foraDoMes: d.getMonth() !== mes });
    }
    var precisaSextaLinha = celulas.slice(35, 42).some(function (c) { return !c.foraDoMes; });
    if (!precisaSextaLinha) celulas = celulas.slice(0, 35);
    return celulas;
  }

  function itensDoDia(iso) {
    var itens = [];
    calendarioCache.forEach(function (c) {
      if (String(c.data).slice(0, 10) !== iso) return;
      if (tipoFiltro !== "todos" && c.tipo !== tipoFiltro) return;
      itens.push({ tipo: "tarefa", id: String(c.id), titulo: c.titulo, status: c.status, sub: c.marca });
    });
    campanhasCache.forEach(function (c) {
      if (!c.prazo || String(c.prazo).slice(0, 10) !== iso) return;
      itens.push({ tipo: "prazo", id: "prazo-" + c.id, titulo: "Prazo: " + c.campanha, status: c.status === "Entregue" ? "feito" : "a fazer", sub: c.cliente });
    });
    return itens;
  }

  function renderizarCelula(cel) {
    var itens = itensDoDia(cel.iso);
    var mostrar = itens.slice(0, 3);
    var resto = itens.length - mostrar.length;
    var hoje = Admin.hojeISO();
    var classes = "celula-dia" + (cel.foraDoMes ? " fora-do-mes" : "") + (cel.iso === hoje ? " hoje" : "");
    var html = '<div class="' + classes + '" data-iso="' + cel.iso + '">' + '<span class="numero-dia">' + cel.data.getDate() + "</span>";
    mostrar.forEach(function (it) {
      html += '<div class="item-dia' + (it.tipo === "prazo" ? " tipo-prazo" : "") + (it.status === "feito" ? " feito" : "") + '" data-acao-item="1" data-id="' + it.id + '" data-tipo-item="' + it.tipo + '" title="' + Admin.escapeHtml(it.titulo) + '">' + Admin.escapeHtml(it.titulo) + "</div>";
    });
    if (resto > 0) html += '<button class="mais-itens-dia" data-mais-dia="' + cel.iso + '">+' + resto + " mais</button>";
    if (!cel.foraDoMes) html += '<button class="botao-add-dia" data-add-dia="' + cel.iso + '">+</button>';
    html += "</div>";
    return html;
  }

  function renderizarGrade() {
    var container = document.getElementById("gradeCalendario");
    var celulas = construirCelulas(anoAtual, mesAtual);
    var html = "";
    DIAS_SEMANA.forEach(function (d) { html += '<div class="cabecalho-dia-semana">' + d + "</div>"; });
    celulas.forEach(function (c) { html += renderizarCelula(c); });
    container.innerHTML = html;
    document.getElementById("rotuloMesAtual").textContent = NOMES_MES[mesAtual] + " " + anoAtual;
  }

  function renderizarAtrasados() {
    var hoje = Admin.hojeISO();
    var atrasados = calendarioCache
      .filter(function (c) { return c.status === "a fazer" && String(c.data).slice(0, 10) < hoje; })
      .sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    var container = document.getElementById("areaAtrasados");
    if (atrasados.length === 0) {
      container.innerHTML = '<p class="texto-vazio">Nada atrasado. Você está em dia com a sua agenda.</p>';
      return;
    }
    var html = '<ul class="lista-simples">';
    atrasados.forEach(function (c) {
      var dias = Admin.diasEntre(String(c.data).slice(0, 10), hoje);
      html += '<li data-id="' + c.id + '" style="cursor:pointer;"><span>' + Admin.escapeHtml(c.titulo) + (c.marca ? " · " + Admin.escapeHtml(c.marca) : "") + '</span><span class="etiqueta-prazo atrasado">há ' + dias + " dia" + (dias === 1 ? "" : "s") + "</span></li>";
    });
    html += "</ul>";
    container.innerHTML = html;
  }

  function abrirModalDia(iso) {
    var itens = itensDoDia(iso);
    document.getElementById("tituloModalDia").textContent = Admin.formatarDataBR(iso);
    var html = itens.length ? '<ul class="lista-simples">' : '<p class="texto-vazio">Nada neste dia.</p>';
    itens.forEach(function (it) {
      html += "<li><span>" + Admin.escapeHtml(it.titulo) + (it.sub ? " · " + Admin.escapeHtml(it.sub) : "") + "</span><span>" + (it.status === "feito" ? "Feito" : "A fazer") + "</span></li>";
    });
    if (itens.length) html += "</ul>";
    document.getElementById("listaModalDia").innerHTML = html;
    Admin.abrirModal("modalDia");
  }

  function abrirModalNovo(iso) {
    document.getElementById("tituloModalCalendario").textContent = "Adicionar na agenda";
    document.getElementById("formCalendario").reset();
    document.getElementById("calendarioId").value = "";
    document.getElementById("calendarioData").value = iso;
    document.getElementById("botaoExcluirCalendario").hidden = true;
    Admin.abrirModal("modalCalendario");
  }

  function abrirModalEdicao(linha) {
    document.getElementById("tituloModalCalendario").textContent = "Editar";
    document.getElementById("calendarioId").value = linha.id;
    document.getElementById("calendarioTitulo").value = linha.titulo || "";
    document.getElementById("calendarioMarca").value = linha.marca || "";
    document.getElementById("calendarioTipo").value = linha.tipo || "gravar";
    document.getElementById("calendarioData").value = String(linha.data).slice(0, 10);
    document.getElementById("calendarioStatus").value = linha.status || "a fazer";
    document.getElementById("botaoExcluirCalendario").hidden = false;
    document.getElementById("botaoExcluirCalendario").dataset.id = linha.id;
    Admin.abrirModal("modalCalendario");
  }

  async function carregarTudo() {
    Admin.limparAvisos("avisosCalendario");

    var respCal = await window.banco.from("calendario").select("*");
    if (respCal.error) {
      if (Admin.ehErroDeEstrutura(respCal.error)) Admin.avisoDeEstrutura("avisosCalendario", "calendario");
      else Admin.mostrarAviso("avisosCalendario", "Não consegui carregar a agenda agora.", "erro");
      calendarioCache = [];
    } else {
      calendarioCache = respCal.data || [];
    }

    var respCamp = await window.banco.from("campanhas").select("id, campanha, cliente, prazo, status");
    if (respCamp.error) {
      if (!Admin.ehErroDeEstrutura(respCamp.error)) Admin.mostrarAviso("avisosCalendario", "Não consegui carregar os prazos de campanha agora.", "erro");
      campanhasCache = [];
    } else {
      campanhasCache = respCamp.data || [];
    }

    renderizarGrade();
    renderizarAtrasados();
  }

  function configurarEventosUmaVez() {
    if (jaConfigurado) return;
    jaConfigurado = true;

    document.getElementById("botaoMesAnterior").addEventListener("click", function () {
      mesAtual--;
      if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
      renderizarGrade();
    });
    document.getElementById("botaoProximoMes").addEventListener("click", function () {
      mesAtual++;
      if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
      renderizarGrade();
    });
    document.getElementById("botaoEsteMes").addEventListener("click", function () {
      var hoje = new Date();
      anoAtual = hoje.getFullYear();
      mesAtual = hoje.getMonth();
      renderizarGrade();
    });

    document.getElementById("filtrosTipoCalendario").addEventListener("click", function (evento) {
      var botao = evento.target.closest(".filtro-pilula-botao");
      if (!botao) return;
      tipoFiltro = botao.getAttribute("data-tipo");
      document.querySelectorAll("#filtrosTipoCalendario .filtro-pilula-botao").forEach(function (b) { b.classList.remove("ativo"); });
      botao.classList.add("ativo");
      renderizarGrade();
    });

    document.getElementById("gradeCalendario").addEventListener("click", function (evento) {
      var addBtn = evento.target.closest("[data-add-dia]");
      if (addBtn) { abrirModalNovo(addBtn.getAttribute("data-add-dia")); return; }
      var maisBtn = evento.target.closest("[data-mais-dia]");
      if (maisBtn) { abrirModalDia(maisBtn.getAttribute("data-mais-dia")); return; }
      var itemEl = evento.target.closest("[data-acao-item]");
      if (itemEl) {
        if (itemEl.getAttribute("data-tipo-item") === "tarefa") {
          var linha = calendarioCache.filter(function (c) { return String(c.id) === itemEl.getAttribute("data-id"); })[0];
          if (linha) abrirModalEdicao(linha);
        }
        return;
      }
      var celula = evento.target.closest(".celula-dia");
      if (celula && !celula.classList.contains("fora-do-mes")) abrirModalNovo(celula.getAttribute("data-iso"));
    });

    document.getElementById("areaAtrasados").addEventListener("click", function (evento) {
      var li = evento.target.closest("li[data-id]");
      if (!li) return;
      var linha = calendarioCache.filter(function (c) { return String(c.id) === li.dataset.id; })[0];
      if (linha) abrirModalEdicao(linha);
    });

    document.getElementById("formCalendario").addEventListener("submit", async function (evento) {
      evento.preventDefault();
      var id = document.getElementById("calendarioId").value;
      var dados = {
        titulo: document.getElementById("calendarioTitulo").value.trim(),
        marca: document.getElementById("calendarioMarca").value.trim() || null,
        tipo: document.getElementById("calendarioTipo").value,
        data: document.getElementById("calendarioData").value,
        status: document.getElementById("calendarioStatus").value
      };
      var resultado = id
        ? await window.banco.from("calendario").update(dados).eq("id", id)
        : await window.banco.from("calendario").insert(dados);
      if (resultado.error) {
        Admin.mostrarAviso("avisosCalendario", "Não consegui salvar agora.", "erro");
        return;
      }
      Admin.fecharModal("modalCalendario");
      carregarTudo();
    });

    document.getElementById("botaoExcluirCalendario").addEventListener("click", async function () {
      var id = this.dataset.id;
      if (!window.confirm("Apagar este item da agenda?")) return;
      var resultado = await window.banco.from("calendario").delete().eq("id", id);
      if (resultado.error) {
        Admin.mostrarAviso("avisosCalendario", "Não consegui apagar agora.", "erro");
        return;
      }
      Admin.fecharModal("modalCalendario");
      carregarTudo();
    });
  }

  window.AdminCalendario = {
    abrir: function () {
      configurarEventosUmaVez();
      if (anoAtual === null) {
        var hoje = new Date();
        anoAtual = hoje.getFullYear();
        mesAtual = hoje.getMonth();
      }
      carregarTudo();
    }
  };
})();
