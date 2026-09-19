/*
  Aba Campanhas: controle financeiro dos trabalhos com marcas.
  Tabela ordenável, favoritos, avisos de prazo e exportar CSV.
*/

(function () {
  "use strict";

  var ORDEM_STATUS = ["Briefing", "Roteiro", "Aprovação Roteiro", "Gravação", "Edição", "Aprovado", "Entregue"];

  var ICONE_ESTRELA_VAZIA = '<svg class="icone" viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,17 5.5,21 7.5,13.5 2,9 9,9"/></svg>';
  var ICONE_ESTRELA_CHEIA = '<svg class="icone" viewBox="0 0 24 24" style="fill:var(--marrom); stroke:var(--marrom);"><polygon points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,17 5.5,21 7.5,13.5 2,9 9,9"/></svg>';

  var campanhasCache = [];
  var filtroAtual = "todas";
  var buscaAtual = "";
  var colunaOrdenacao = null;
  var direcaoOrdenacao = "asc";
  var jaConfigurado = false;

  function corStatus(status) {
    var indice = ORDEM_STATUS.indexOf(status);
    if (indice <= 2) return "var(--texto-suave)";
    if (indice <= 4) return "var(--marrom)";
    return "var(--ok)";
  }

  function stat(valor, rotulo) {
    return '<div class="stat-item"><span class="stat-valor">' + Admin.escapeHtml(valor) + '</span><span class="stat-rotulo">' + rotulo + "</span></div>";
  }
  function statComSub(valor, rotulo, sub) {
    return '<div class="stat-item"><span class="stat-valor">' + Admin.escapeHtml(valor) + '</span><span class="stat-rotulo">' + rotulo + '</span><span class="stat-sub">' + Admin.escapeHtml(sub) + "</span></div>";
  }

  function renderizarStats() {
    var total = campanhasCache.length;
    var ativas = campanhasCache.filter(function (c) { return c.ativa; }).length;
    var valorTotal = campanhasCache.reduce(function (s, c) { return s + (Number(c.valor) || 0); }, 0);
    var qtdTotal = campanhasCache.reduce(function (s, c) { return s + (Number(c.qtd) || 0); }, 0);
    var aReceber = campanhasCache.filter(function (c) { return c.pagamento === "pendente"; }).reduce(function (s, c) { return s + (Number(c.valor) || 0); }, 0);
    var recebido = campanhasCache.filter(function (c) { return c.pagamento === "pago"; }).reduce(function (s, c) { return s + (Number(c.valor) || 0); }, 0);

    var subValor = qtdTotal > 0 ? Admin.formatarMoeda(valorTotal / qtdTotal) + " por vídeo" : "ainda sem vídeos pra calcular";

    document.getElementById("faixaStatsCampanhas").innerHTML =
      stat(total, "Total de campanhas") +
      stat(ativas, "Ativas") +
      statComSub(Admin.formatarMoeda(valorTotal), "Valor total", subValor) +
      statComSub(Admin.formatarMoeda(aReceber), "A receber", Admin.formatarMoeda(recebido) + " já recebido");
  }

  function aplicarFiltrosOrdenacaoRender() {
    var termo = buscaAtual.trim().toLowerCase();
    var lista = campanhasCache.filter(function (c) {
      if (filtroAtual === "ativas" && !c.ativa) return false;
      if (filtroAtual === "finalizadas" && c.ativa) return false;
      if (!termo) return true;
      return ((c.campanha || "") + " " + (c.cliente || "")).toLowerCase().indexOf(termo) !== -1;
    });
    if (colunaOrdenacao) {
      lista = lista.slice().sort(function (a, b) {
        var cmp;
        if (colunaOrdenacao === "status") {
          cmp = ORDEM_STATUS.indexOf(a.status) - ORDEM_STATUS.indexOf(b.status);
        } else if (colunaOrdenacao === "valor" || colunaOrdenacao === "qtd") {
          cmp = (Number(a[colunaOrdenacao]) || 0) - (Number(b[colunaOrdenacao]) || 0);
        } else if (colunaOrdenacao === "prazo") {
          cmp = String(a.prazo || "").localeCompare(String(b.prazo || ""));
        } else {
          cmp = String(a[colunaOrdenacao] || "").toLowerCase().localeCompare(String(b[colunaOrdenacao] || "").toLowerCase());
        }
        return direcaoOrdenacao === "asc" ? cmp : -cmp;
      });
    }
    renderizarTabela(lista);
  }

  function renderizarTabela(lista) {
    var corpo = document.getElementById("corpoTabelaCampanhas");
    if (campanhasCache.length === 0) {
      corpo.innerHTML = '<tr><td colspan="9"><p class="texto-vazio">Nenhuma campanha cadastrada ainda. Clique em "Adicionar campanha" pra começar.</p></td></tr>';
      return;
    }
    if (lista.length === 0) {
      corpo.innerHTML = '<tr><td colspan="9"><p class="texto-vazio">Nenhuma campanha encontrada com esse filtro ou busca.</p></td></tr>';
      return;
    }
    var hoje = Admin.hojeISO();
    corpo.innerHTML = "";
    lista.forEach(function (c) {
      var tr = document.createElement("tr");
      tr.dataset.id = c.id;
      tr.style.cursor = "pointer";
      if (c.favorita) tr.classList.add("linha-favorita");

      var etiquetaPrazo = "";
      if (c.prazo && c.status !== "Entregue") {
        var dias = Admin.diasEntre(hoje, String(c.prazo).slice(0, 10));
        if (dias < 0) etiquetaPrazo = '<span class="etiqueta-prazo atrasado">atrasado ' + Math.abs(dias) + " dia" + (Math.abs(dias) === 1 ? "" : "s") + "</span>";
        else if (dias <= 3) etiquetaPrazo = '<span class="etiqueta-prazo perto">vence em ' + dias + " dia" + (dias === 1 ? "" : "s") + "</span>";
      }

      tr.innerHTML =
        '<td><button class="botao-icone" data-acao="favoritar" title="Destacar campanha">' + (c.favorita ? ICONE_ESTRELA_CHEIA : ICONE_ESTRELA_VAZIA) + "</button></td>" +
        "<td>" + Admin.escapeHtml(c.campanha) + "</td>" +
        "<td>" + Admin.escapeHtml(c.cliente) + "</td>" +
        '<td><span class="pilula" style="color:var(--marrom)">' + Admin.escapeHtml(c.tipo) + "</span></td>" +
        '<td><span class="pilula" style="color:' + corStatus(c.status) + '">' + Admin.escapeHtml(c.status) + "</span></td>" +
        "<td>" + (c.qtd || 0) + "</td>" +
        "<td>" + Admin.formatarMoeda(c.valor) + "</td>" +
        "<td>" + (c.prazo ? Admin.formatarDataBR(c.prazo) : "-") + etiquetaPrazo + "</td>" +
        '<td><span class="pilula" style="color:' + (c.pagamento === "pago" ? "var(--ok)" : "var(--aviso)") + '">' + (c.pagamento === "pago" ? "Pago" : "Pendente") + "</span></td>";
      corpo.appendChild(tr);
    });
  }

  function abrirModalNovo() {
    document.getElementById("tituloModalCampanha").textContent = "Adicionar campanha";
    document.getElementById("formCampanha").reset();
    document.getElementById("campanhaId").value = "";
    document.getElementById("campanhaAtiva").checked = true;
    document.getElementById("botaoExcluirCampanha").hidden = true;
    Admin.abrirModal("modalCampanha");
  }

  function abrirModalEdicao(c) {
    document.getElementById("tituloModalCampanha").textContent = "Editar campanha";
    document.getElementById("campanhaId").value = c.id;
    document.getElementById("campanhaNome").value = c.campanha || "";
    document.getElementById("campanhaCliente").value = c.cliente || "";
    document.getElementById("campanhaTipo").value = c.tipo || "Conteúdo";
    document.getElementById("campanhaStatus").value = c.status || "Briefing";
    document.getElementById("campanhaQtd").value = c.qtd || 1;
    document.getElementById("campanhaValor").value = c.valor || 0;
    document.getElementById("campanhaPrazo").value = c.prazo ? String(c.prazo).slice(0, 10) : "";
    document.getElementById("campanhaPagamento").value = c.pagamento || "pendente";
    document.getElementById("campanhaAtiva").checked = !!c.ativa;
    document.getElementById("botaoExcluirCampanha").hidden = false;
    document.getElementById("botaoExcluirCampanha").dataset.id = c.id;
    Admin.abrirModal("modalCampanha");
  }

  async function alternarFavorita(c) {
    var resultado = await window.banco.from("campanhas").update({ favorita: !c.favorita }).eq("id", c.id);
    if (resultado.error) { Admin.mostrarAviso("avisosCampanhas", "Não consegui atualizar agora.", "erro"); return; }
    carregarTudo();
  }

  function exportarCSV() {
    var colunas = ["Campanha", "Cliente", "Tipo", "Status", "Quantidade", "Valor", "Prazo", "Pagamento", "Ativa", "Favorita"];
    var linhas = campanhasCache.map(function (c) {
      return [c.campanha, c.cliente, c.tipo, c.status, c.qtd, String(c.valor || 0).replace(".", ","), c.prazo ? Admin.formatarDataBR(c.prazo) : "", c.pagamento === "pago" ? "Pago" : "Pendente", c.ativa ? "Sim" : "Não", c.favorita ? "Sim" : "Não"];
    });
    Admin.baixarCSV("campanhas.csv", colunas, linhas);
  }

  async function carregarTudo() {
    Admin.limparAvisos("avisosCampanhas");
    var resposta = await window.banco.from("campanhas").select("*").order("criado_em", { ascending: false });
    if (resposta.error) {
      if (Admin.ehErroDeEstrutura(resposta.error)) Admin.avisoDeEstrutura("avisosCampanhas", "campanhas");
      else Admin.mostrarAviso("avisosCampanhas", "Não consegui carregar as campanhas agora.", "erro");
      campanhasCache = [];
    } else {
      campanhasCache = resposta.data || [];
    }
    renderizarStats();
    aplicarFiltrosOrdenacaoRender();
  }

  function configurarEventosUmaVez() {
    if (jaConfigurado) return;
    jaConfigurado = true;

    document.getElementById("botaoNovaCampanha").addEventListener("click", abrirModalNovo);
    document.getElementById("botaoExportarCampanhas").addEventListener("click", exportarCSV);

    document.getElementById("buscaCampanhas").addEventListener("input", function (evento) {
      buscaAtual = evento.target.value;
      aplicarFiltrosOrdenacaoRender();
    });

    document.getElementById("filtrosCampanhas").addEventListener("click", function (evento) {
      var botao = evento.target.closest(".filtro-pilula-botao");
      if (!botao) return;
      filtroAtual = botao.getAttribute("data-filtro");
      document.querySelectorAll("#filtrosCampanhas .filtro-pilula-botao").forEach(function (b) { b.classList.remove("ativo"); });
      botao.classList.add("ativo");
      aplicarFiltrosOrdenacaoRender();
    });

    document.querySelectorAll("th.ordenavel").forEach(function (th) {
      th.addEventListener("click", function () {
        var coluna = th.getAttribute("data-coluna");
        if (colunaOrdenacao === coluna) {
          direcaoOrdenacao = direcaoOrdenacao === "asc" ? "desc" : "asc";
        } else {
          colunaOrdenacao = coluna;
          direcaoOrdenacao = "asc";
        }
        document.querySelectorAll("th.ordenavel").forEach(function (t) {
          t.classList.remove("ativa");
          t.querySelector(".seta").textContent = "▲";
        });
        th.classList.add("ativa");
        th.querySelector(".seta").textContent = direcaoOrdenacao === "asc" ? "▲" : "▼";
        aplicarFiltrosOrdenacaoRender();
      });
    });

    document.getElementById("corpoTabelaCampanhas").addEventListener("click", function (evento) {
      var estrelaBtn = evento.target.closest('[data-acao="favoritar"]');
      if (estrelaBtn) {
        var trEstrela = estrelaBtn.closest("tr");
        var campEstrela = campanhasCache.filter(function (c) { return String(c.id) === trEstrela.dataset.id; })[0];
        if (campEstrela) alternarFavorita(campEstrela);
        return;
      }
      var tr = evento.target.closest("tr[data-id]");
      if (!tr) return;
      var campanha = campanhasCache.filter(function (c) { return String(c.id) === tr.dataset.id; })[0];
      if (campanha) abrirModalEdicao(campanha);
    });

    document.getElementById("formCampanha").addEventListener("submit", async function (evento) {
      evento.preventDefault();
      var id = document.getElementById("campanhaId").value;
      var dados = {
        campanha: document.getElementById("campanhaNome").value.trim(),
        cliente: document.getElementById("campanhaCliente").value.trim(),
        tipo: document.getElementById("campanhaTipo").value,
        status: document.getElementById("campanhaStatus").value,
        qtd: Number(document.getElementById("campanhaQtd").value) || 1,
        valor: Number(document.getElementById("campanhaValor").value) || 0,
        prazo: document.getElementById("campanhaPrazo").value || null,
        pagamento: document.getElementById("campanhaPagamento").value,
        ativa: document.getElementById("campanhaAtiva").checked
      };
      var resultado = id
        ? await window.banco.from("campanhas").update(dados).eq("id", id)
        : await window.banco.from("campanhas").insert(dados);
      if (resultado.error) {
        Admin.mostrarAviso("avisosCampanhas", "Não consegui salvar agora.", "erro");
        return;
      }
      Admin.fecharModal("modalCampanha");
      carregarTudo();
    });

    document.getElementById("botaoExcluirCampanha").addEventListener("click", async function () {
      var id = this.dataset.id;
      if (!window.confirm("Apagar esta campanha? Essa ação não pode ser desfeita.")) return;
      var resultado = await window.banco.from("campanhas").delete().eq("id", id);
      if (resultado.error) {
        Admin.mostrarAviso("avisosCampanhas", "Não consegui apagar agora.", "erro");
        return;
      }
      Admin.fecharModal("modalCampanha");
      carregarTudo();
    });
  }

  window.AdminCampanhas = {
    abrir: function () {
      configurarEventosUmaVez();
      carregarTudo();
    }
  };
})();
