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
  var marcasParaImportar = [];

  // ---------------------------------------------------------
  // Importar planilha (CSV) de marcas
  // ---------------------------------------------------------

  function normalizarTexto(valor) {
    return (valor || "").toString().trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // Lê o CSV na unha (aceita vírgula ou ponto e vírgula como
  // separador, e campos entre aspas com vírgula/quebra de linha
  // dentro), pra funcionar com planilha exportada tanto do Excel
  // quanto do Google Planilhas, em português ou inglês.
  function analisarCSV(texto) {
    if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
    var primeiraLinha = texto.split(/\r\n|\n|\r/)[0] || "";
    var delimitador = primeiraLinha.split(";").length >= primeiraLinha.split(",").length ? ";" : ",";

    var linhas = [];
    var linhaAtual = [];
    var campoAtual = "";
    var dentroAspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (dentroAspas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campoAtual += '"'; i++; }
          else { dentroAspas = false; }
        } else {
          campoAtual += c;
        }
      } else if (c === '"') {
        dentroAspas = true;
      } else if (c === delimitador) {
        linhaAtual.push(campoAtual);
        campoAtual = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linhaAtual.push(campoAtual);
        campoAtual = "";
        linhas.push(linhaAtual);
        linhaAtual = [];
      } else {
        campoAtual += c;
      }
    }
    if (campoAtual !== "" || linhaAtual.length > 0) {
      linhaAtual.push(campoAtual);
      linhas.push(linhaAtual);
    }
    return linhas.filter(function (l) { return l.some(function (c) { return c.trim() !== ""; }); });
  }

  var MAPA_CABECALHOS = {
    nome: ["nome", "marca", "empresa", "cliente", "nome da marca", "name", "brand"],
    instagram: ["instagram", "insta", "@", "usuario", "usuário"],
    email: ["email", "e-mail", "mail"],
    telefone: ["telefone", "fone", "whatsapp", "celular", "tel", "phone"],
    situacao: ["situacao", "situação", "status", "etapa"],
    obs: ["obs", "observacao", "observação", "observacoes", "observações", "notas", "nota"],
    ultimo_contato: ["ultimo_contato", "último contato", "ultimo contato", "data", "data do contato", "data contato"]
  };

  function mapearColunas(cabecalho) {
    var mapa = {};
    cabecalho.forEach(function (coluna, indice) {
      var normalizado = normalizarTexto(coluna);
      Object.keys(MAPA_CABECALHOS).forEach(function (campo) {
        if (mapa[campo] !== undefined) return;
        var bate = MAPA_CABECALHOS[campo].some(function (alias) { return normalizarTexto(alias) === normalizado; });
        if (bate) mapa[campo] = indice;
      });
    });
    return mapa;
  }

  function normalizarSituacaoImportada(valor) {
    var n = normalizarTexto(valor);
    if (n.indexOf("cliente") !== -1) return "cliente";
    if (n.indexOf("convers") !== -1) return "conversando";
    if (n.indexOf("parad") !== -1) return "parada";
    return "lead";
  }

  function normalizarDataImportada(valor) {
    if (!valor) return null;
    var v = valor.trim();
    if (!v) return null;
    var isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
    var brMatch = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (brMatch) {
      var dia = brMatch[1].padStart(2, "0");
      var mes = brMatch[2].padStart(2, "0");
      var ano = brMatch[3].length === 2 ? "20" + brMatch[3] : brMatch[3];
      return ano + "-" + mes + "-" + dia;
    }
    return null;
  }

  function processarArquivoCSV(arquivo) {
    var leitor = new FileReader();
    leitor.onload = function (e) {
      var linhas = analisarCSV(String(e.target.result));
      if (linhas.length < 2) {
        window.alert("Não encontrei nenhuma linha de dados nessa planilha.");
        return;
      }
      var mapa = mapearColunas(linhas[0]);
      if (mapa.nome === undefined) {
        window.alert('Não encontrei uma coluna de nome da marca. Confira se a primeira linha da planilha tem os títulos das colunas (ex: "Nome", "Instagram", "E-mail"...).');
        return;
      }
      function pegar(linha, campo) { return mapa[campo] !== undefined ? (linha[mapa[campo]] || "").trim() : ""; }
      marcasParaImportar = linhas.slice(1).map(function (linha) {
        return {
          nome: pegar(linha, "nome"),
          instagram: pegar(linha, "instagram") || null,
          email: pegar(linha, "email") || null,
          telefone: pegar(linha, "telefone") || null,
          situacao: normalizarSituacaoImportada(pegar(linha, "situacao")),
          obs: pegar(linha, "obs") || null,
          ultimo_contato: normalizarDataImportada(pegar(linha, "ultimo_contato"))
        };
      }).filter(function (m) { return m.nome; });

      if (marcasParaImportar.length === 0) {
        window.alert("Não encontrei nenhuma marca com o nome preenchido nessa planilha.");
        return;
      }
      mostrarPreviaImportacao();
    };
    leitor.onerror = function () {
      window.alert("Não consegui ler esse arquivo. Confira se é um .csv válido.");
    };
    leitor.readAsText(arquivo, "UTF-8");
  }

  function mostrarPreviaImportacao() {
    document.getElementById("resumoImportarMarcas").textContent =
      "Encontrei " + marcasParaImportar.length + " marca(s) na planilha. Confira abaixo (mostrando até 15) e clique em \"Confirmar importação\" pra adicionar todas no seu CRM.";
    var corpo = document.getElementById("corpoPreviaImportarMarcas");
    corpo.innerHTML = "";
    marcasParaImportar.slice(0, 15).forEach(function (m) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + Admin.escapeHtml(m.nome) + "</td>" +
        "<td>" + Admin.escapeHtml(m.instagram || "-") + "</td>" +
        "<td>" + Admin.escapeHtml(m.email || "-") + "</td>" +
        "<td>" + Admin.escapeHtml(m.telefone || "-") + "</td>" +
        "<td>" + Admin.escapeHtml(ROTULOS_SITUACAO[m.situacao] || m.situacao) + "</td>" +
        "<td>" + (m.ultimo_contato ? Admin.formatarDataBR(m.ultimo_contato) : "-") + "</td>";
      corpo.appendChild(tr);
    });
    if (marcasParaImportar.length > 15) {
      var trMais = document.createElement("tr");
      trMais.innerHTML = '<td colspan="6" style="text-align:center; color:var(--texto-suave);">+ ' + (marcasParaImportar.length - 15) + " marca(s) a mais…</td>";
      corpo.appendChild(trMais);
    }
    Admin.abrirModal("modalImportarMarcas");
  }

  async function confirmarImportacaoMarcas() {
    if (marcasParaImportar.length === 0) return;
    var botao = document.getElementById("botaoConfirmarImportarMarcas");
    botao.disabled = true;
    try {
      var LOTE = 50;
      var erros = 0;
      for (var i = 0; i < marcasParaImportar.length; i += LOTE) {
        var pedaco = marcasParaImportar.slice(i, i + LOTE);
        var resultado = await window.banco.from("marcas").insert(pedaco);
        if (resultado.error) erros++;
      }
      var totalImportadas = marcasParaImportar.length;
      marcasParaImportar = [];
      Admin.fecharModal("modalImportarMarcas");
      if (erros > 0) {
        window.alert("Importei parte das marcas, mas algum lote deu erro. Confira a lista e, se faltar alguma, tente importar de novo.");
      } else {
        Admin.mostrarAviso("avisosMarcas", totalImportadas + " marca(s) importada(s) com sucesso.", "ok");
      }
      carregarTudo();
    } catch (erro) {
      window.alert("Não consegui importar agora: " + (erro && erro.message ? erro.message : erro));
    } finally {
      botao.disabled = false;
    }
  }

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

    document.getElementById("botaoImportarMarcas").addEventListener("click", function () {
      document.getElementById("arquivoImportarMarcas").click();
    });
    document.getElementById("arquivoImportarMarcas").addEventListener("change", function (evento) {
      var arquivo = evento.target.files[0];
      if (arquivo) processarArquivoCSV(arquivo);
      evento.target.value = "";
    });
    document.getElementById("botaoConfirmarImportarMarcas").addEventListener("click", confirmarImportacaoMarcas);

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
