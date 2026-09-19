/*
  Aba Marcas: a base de contatos de empresa, em formato de
  planilha, com busca, filtro por situação, exportar CSV e
  atalhos pra WhatsApp e Instagram.
*/

(function () {
  "use strict";

  var CORES_SITUACAO = {
    lead: "var(--marrom)",
    conversando: "var(--aviso)",
    cliente: "var(--ok)",
    parada: "var(--texto-suave)"
  };
  var ROTULOS_SITUACAO = { lead: "Lead", conversando: "Conversando", cliente: "Cliente", parada: "Parada" };

  var ICONE_WHATSAPP = '<svg class="icone" viewBox="0 0 24 24"><path d="M4 20l1.4-4.2A8 8 0 1 1 9 19.6z"/><path d="M8.5 9.5c0 3 2.5 5.5 5.5 5.5"/></svg>';

  var marcasCache = [];
  var situacaoAtual = "todas";
  var buscaAtual = "";
  var jaConfigurado = false;

  function somenteDigitos(texto) { return (texto || "").replace(/\D/g, ""); }

  function linkInstagram(handle) {
    if (!handle) return "";
    var limpo = handle.trim().replace(/^@/, "");
    return "https://instagram.com/" + encodeURIComponent(limpo);
  }

  function linkWhatsApp(telefone) {
    var digitos = somenteDigitos(telefone);
    if (!digitos) return "";
    if (digitos.length <= 11) digitos = "55" + digitos;
    return "https://wa.me/" + digitos;
  }

  function aplicarFiltros() {
    var termo = buscaAtual.trim().toLowerCase();
    var filtradas = marcasCache.filter(function (m) {
      var passaSituacao = situacaoAtual === "todas" || m.situacao === situacaoAtual;
      if (!passaSituacao) return false;
      if (!termo) return true;
      var alvo = ((m.nome || "") + " " + (m.instagram || "") + " " + (m.email || "")).toLowerCase();
      return alvo.indexOf(termo) !== -1;
    });
    renderizarTabela(filtradas);
  }

  function renderizarTabela(marcas) {
    var corpo = document.getElementById("corpoTabelaMarcas");
    if (marcasCache.length === 0) {
      corpo.innerHTML = '<tr><td colspan="7"><p class="texto-vazio">Nenhuma marca cadastrada ainda. Clique em "Adicionar marca" pra começar.</p></td></tr>';
      return;
    }
    if (marcas.length === 0) {
      corpo.innerHTML = '<tr><td colspan="7"><p class="texto-vazio">Nenhuma marca encontrada com esse filtro ou busca.</p></td></tr>';
      return;
    }
    corpo.innerHTML = "";
    marcas.forEach(function (m) {
      var tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.dataset.id = m.id;
      var cor = CORES_SITUACAO[m.situacao] || "var(--texto-suave)";
      var rotulo = ROTULOS_SITUACAO[m.situacao] || m.situacao;
      var contatoHtml = "";
      if (m.telefone) {
        contatoHtml += '<a class="botao-icone" data-parar-propagacao="1" href="' + linkWhatsApp(m.telefone) + '" target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp">' + ICONE_WHATSAPP + "</a>";
      }
      tr.innerHTML =
        "<td>" + Admin.escapeHtml(m.nome) + "</td>" +
        "<td>" + (m.instagram ? '<a data-parar-propagacao="1" href="' + linkInstagram(m.instagram) + '" target="_blank" rel="noopener noreferrer">' + Admin.escapeHtml(m.instagram) + "</a>" : "-") + "</td>" +
        "<td>" + Admin.escapeHtml(m.email || "-") + "</td>" +
        "<td>" + Admin.escapeHtml(m.telefone || "-") + "</td>" +
        '<td><span class="pilula" style="color:' + cor + '">' + rotulo + "</span></td>" +
        "<td>" + (m.ultimo_contato ? Admin.formatarDataBR(m.ultimo_contato) : "-") + "</td>" +
        "<td>" + (contatoHtml || "-") + "</td>";
      corpo.appendChild(tr);
    });
  }

  function abrirModalNovo() {
    document.getElementById("tituloModalMarca").textContent = "Adicionar marca";
    document.getElementById("formMarca").reset();
    document.getElementById("marcaId").value = "";
    document.getElementById("botaoExcluirMarca").hidden = true;
    Admin.abrirModal("modalMarca");
  }

  function abrirModalEdicao(marca) {
    document.getElementById("tituloModalMarca").textContent = "Editar marca";
    document.getElementById("marcaId").value = marca.id;
    document.getElementById("marcaNome").value = marca.nome || "";
    document.getElementById("marcaInstagram").value = marca.instagram || "";
    document.getElementById("marcaTelefone").value = marca.telefone || "";
    document.getElementById("marcaEmail").value = marca.email || "";
    document.getElementById("marcaSituacao").value = marca.situacao || "lead";
    document.getElementById("marcaUltimoContato").value = marca.ultimo_contato ? String(marca.ultimo_contato).slice(0, 10) : "";
    document.getElementById("marcaObs").value = marca.obs || "";
    document.getElementById("botaoExcluirMarca").hidden = false;
    document.getElementById("botaoExcluirMarca").dataset.id = marca.id;
    Admin.abrirModal("modalMarca");
  }

  function exportarCSV() {
    var colunas = ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato"];
    var linhas = marcasCache.map(function (m) {
      return [m.nome, m.instagram, m.email, m.telefone, ROTULOS_SITUACAO[m.situacao] || m.situacao, m.obs, m.ultimo_contato ? Admin.formatarDataBR(m.ultimo_contato) : ""];
    });
    Admin.baixarCSV("marcas.csv", colunas, linhas);
  }

  async function carregarTudo() {
    Admin.limparAvisos("avisosMarcas");
    var resposta = await window.banco.from("marcas").select("*").order("criado_em", { ascending: false });
    if (resposta.error) {
      if (Admin.ehErroDeEstrutura(resposta.error)) Admin.avisoDeEstrutura("avisosMarcas", "marcas");
      else Admin.mostrarAviso("avisosMarcas", "Não consegui carregar as marcas agora.", "erro");
      marcasCache = [];
    } else {
      marcasCache = resposta.data || [];
    }
    aplicarFiltros();
  }

  function configurarEventosUmaVez() {
    if (jaConfigurado) return;
    jaConfigurado = true;

    document.getElementById("botaoNovaMarca").addEventListener("click", abrirModalNovo);
    document.getElementById("botaoExportarMarcas").addEventListener("click", exportarCSV);

    document.getElementById("buscaMarcas").addEventListener("input", function (evento) {
      buscaAtual = evento.target.value;
      aplicarFiltros();
    });

    document.getElementById("filtrosSituacao").addEventListener("click", function (evento) {
      var botao = evento.target.closest(".filtro-pilula-botao");
      if (!botao) return;
      situacaoAtual = botao.getAttribute("data-situacao");
      document.querySelectorAll("#filtrosSituacao .filtro-pilula-botao").forEach(function (b) { b.classList.remove("ativo"); });
      botao.classList.add("ativo");
      aplicarFiltros();
    });

    document.getElementById("corpoTabelaMarcas").addEventListener("click", function (evento) {
      if (evento.target.closest('[data-parar-propagacao="1"]')) return;
      var tr = evento.target.closest("tr[data-id]");
      if (!tr) return;
      var marca = marcasCache.filter(function (m) { return String(m.id) === String(tr.dataset.id); })[0];
      if (marca) abrirModalEdicao(marca);
    });

    document.getElementById("formMarca").addEventListener("submit", async function (evento) {
      evento.preventDefault();
      var id = document.getElementById("marcaId").value;
      var dados = {
        nome: document.getElementById("marcaNome").value.trim(),
        instagram: document.getElementById("marcaInstagram").value.trim() || null,
        telefone: document.getElementById("marcaTelefone").value.trim() || null,
        email: document.getElementById("marcaEmail").value.trim() || null,
        situacao: document.getElementById("marcaSituacao").value,
        ultimo_contato: document.getElementById("marcaUltimoContato").value || null,
        obs: document.getElementById("marcaObs").value.trim() || null
      };
      var resultado = id
        ? await window.banco.from("marcas").update(dados).eq("id", id)
        : await window.banco.from("marcas").insert(dados);
      if (resultado.error) {
        Admin.mostrarAviso("avisosMarcas", "Não consegui salvar a marca agora.", "erro");
        return;
      }
      Admin.fecharModal("modalMarca");
      carregarTudo();
    });

    document.getElementById("botaoExcluirMarca").addEventListener("click", async function () {
      var id = this.dataset.id;
      if (!window.confirm("Apagar esta marca? Essa ação não pode ser desfeita.")) return;
      var resultado = await window.banco.from("marcas").delete().eq("id", id);
      if (resultado.error) {
        Admin.mostrarAviso("avisosMarcas", "Não consegui apagar agora.", "erro");
        return;
      }
      Admin.fecharModal("modalMarca");
      carregarTudo();
    });
  }

  window.AdminMarcas = {
    abrir: function () {
      configurarEventosUmaVez();
      carregarTudo();
    }
  };
})();
