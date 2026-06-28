const SUPABASE_URL = "https://gezkcgecyudkqareydhn.supabase.co";
const SUPABASE_KEY = "sb_publishable_DRyJOsPzwUqUQG46fOy1GQ_Bh1m2WUE";

if (!window.supabase) {
  alert("Biblioteca do Supabase não carregou. Recarregue a página.");
  throw new Error("window.supabase não está disponível");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
    doces: [],
    vendas: []
};

async function carregarDoces() {

    const { data, error } = await supabaseClient
        .from("doces")
        .select("*")
        .order("nome");

    if (error) {
      mostrarErroSupabase(error, "carregar doces");
        return;
    }

    state.doces = data;
}

async function carregarVendas() {

    const { data, error } = await supabaseClient
        .from("vendas")
        .select("*")
        .order("data", {
            ascending: false
        });

    if (error) {
      mostrarErroSupabase(error, "carregar vendas");
        return;
    }

    state.vendas = data.map(normalizarVenda);
}

async function carregarTudo() {

    await carregarDoces();

    await carregarVendas();

    render();

}

function normalizarVenda(venda) {
  return {
    id: venda.id,
    doceId: venda.doce_id ?? venda.doceId,
    doceNome: venda.doce_nome ?? venda.doceNome,
    quantidade: Number(venda.quantidade ?? 0),
    valorTotal: Number(venda.valor_total ?? venda.valorTotal ?? 0),
    data: venda.data,
  };
}

function mostrarErroSupabase(error, acao) {
  console.error(`Erro ao ${acao}:`, error);

  const detalhes = error?.message || "Erro desconhecido";
  const codigo = error?.code ? ` (codigo ${error.code})` : "";
  const extras = [error?.details, error?.hint].filter(Boolean).join(" | ");
  const dicaRls =
    error?.code === "42501" || error?.status === 401 || error?.status === 403
      ? " Verifique as políticas RLS (SELECT/INSERT/UPDATE/DELETE) no Supabase."
      : "";

  alert(`Não foi possível ${acao}. ${detalhes}${codigo}.${dicaRls}${extras ? ` Detalhes: ${extras}` : ""}`);
}

async function testarConexaoSupabase() {
  const { error } = await supabaseClient
    .from("doces")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (error) {
    mostrarErroSupabase(error, "validar conexão com o Supabase");
  }
}




const tabs = document.querySelectorAll(".tab");
const screens = document.querySelectorAll(".screen");

const formCadastro = document.getElementById("form-cadastro");
const formVenda = document.getElementById("form-venda");
const formReposicao = document.getElementById("form-reposicao");

const tabelaDoces = document.getElementById("tabela-doces");
const selectDoceVenda = document.getElementById("doceVenda");
const selectDoceReposicao = document.getElementById("doceReposicao");
const listaVendas = document.getElementById("lista-vendas");
const resumoEstoque = document.getElementById("resumo-estoque");
const btnExportar = document.getElementById("btn-exportar");

const mEstoque = document.getElementById("m-estoque");
const mVendidos = document.getElementById("m-vendidos");
const mFaturamento = document.getElementById("m-faturamento");
const mDoces = document.getElementById("m-doces");

init();

async function init() {

  await testarConexaoSupabase();

    setupTabs();

    setupForms();

    setupActions();

    await carregarTudo();

}

function setupActions() {
  btnExportar.addEventListener("click", exportarParaExcel);
}

function setupTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.screen;

      tabs.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");

      screens.forEach((screen) => {
        screen.classList.toggle("active", screen.id === target);
      });
    });
  });
}

function setupForms() {
  formCadastro.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = document.getElementById("nome").value.trim();
    const itensPorSaco = Number(document.getElementById("itensPorSaco").value);
    const qtdSacos = Number(document.getElementById("qtdSacos").value);
    const precoItem = Number(document.getElementById("precoItem").value);

    if (!nome || itensPorSaco <= 0 || qtdSacos <= 0 || precoItem < 0) {
      alert("Preencha os campos corretamente.");
      return;
    }

    try {

    const { error } = await supabaseClient
        .from("doces")
        .insert({
            nome: nome,
            itens_por_saco: itensPorSaco,
            qtd_sacos: qtdSacos,
            estoque_itens: itensPorSaco * qtdSacos,
            preco_item: precoItem
        });

    if (error)
        throw error;

    formCadastro.reset();

    document.getElementById("itensPorSaco").value = 10;
    document.getElementById("qtdSacos").value = 1;
    document.getElementById("precoItem").value = "1.00";

    await carregarTudo();

} catch (err) {

  mostrarErroSupabase(err, "cadastrar doce");

}
  });

  formVenda.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = selectDoceVenda.value;
    const qtdVendida = Number(document.getElementById("qtdVendida").value);
    const doce = state.doces.find((item) => String(item.id) === String(id));

    if (!doce) {
      alert("Selecione um doce para vender.");
      return;
    }

    if (qtdVendida <= 0) {
      alert("Quantidade inválida.");
      return;
    }

    if (doce.estoque_itens < qtdVendida) {
      alert("Estoque insuficiente para essa venda.");
      return;
    }

    try {
      const { error } = await supabaseClient.rpc("registrar_venda", {
        p_doce_id: doce.id,
        p_quantidade: qtdVendida,
      });

      if (error) {
        throw error;
      }

      formVenda.reset();
      document.getElementById("qtdVendida").value = 1;
      await carregarTudo();
    } catch (error) {
      mostrarErroSupabase(error, "registrar venda");
    }
  });

  formReposicao.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = selectDoceReposicao.value;
    const qtdReposicao = Number(document.getElementById("qtdReposicao").value);
    const doce = state.doces.find((item) => String(item.id) === String(id));

    if (!doce) {
      alert("Selecione um doce para repor.");
      return;
    }

    if (qtdReposicao <= 0) {
      alert("Quantidade inválida para reposição.");
      return;
    }

    const novosSacos = Number(doce.qtd_sacos) + qtdReposicao;
    const novoEstoque = Number(doce.estoque_itens) + qtdReposicao * Number(doce.itens_por_saco);

    try {
      const { error } = await supabaseClient
        .from("doces")
        .update({
          qtd_sacos: novosSacos,
          estoque_itens: novoEstoque,
        })
        .eq("id", doce.id);

      if (error) {
        throw error;
      }

      formReposicao.reset();
      document.getElementById("qtdReposicao").value = 1;
      await carregarTudo();
    } catch (error) {
      mostrarErroSupabase(error, "repor estoque");
    }
  });
}

function render() {
  renderDoces();
  renderSelectVenda();
  renderSelectReposicao();
  renderVendas();
  renderDashboard();
}

function renderDoces() {
  tabelaDoces.innerHTML = "";

  if (state.doces.length === 0) {
    tabelaDoces.innerHTML = "<tr><td colspan='5'>Nenhum doce cadastrado.</td></tr>";
    return;
  }

  state.doces.forEach((doce) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${doce.nome}</td>
      <td>${doce.qtd_sacos}</td>
      <td>${doce.itens_por_saco}</td>
      <td>${doce.estoque_itens}</td>
      <td>${formatCurrency(Number(doce.preco_item))}</td>
    `;
    tabelaDoces.appendChild(row);
  });
}

function renderSelectVenda() {
  selectDoceVenda.innerHTML = "";

  if (state.doces.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Cadastre um doce primeiro";
    selectDoceVenda.appendChild(option);
    return;
  }

  state.doces.forEach((doce) => {
    const option = document.createElement("option");
    option.value = doce.id;
    option.textContent = `${doce.nome} (estoque: ${doce.estoque_itens})`;
    selectDoceVenda.appendChild(option);
  });
}

function renderSelectReposicao() {
  selectDoceReposicao.innerHTML = "";

  if (state.doces.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Cadastre um doce primeiro";
    selectDoceReposicao.appendChild(option);
    return;
  }

  state.doces.forEach((doce) => {
    const option = document.createElement("option");
    option.value = doce.id;
    option.textContent = `${doce.nome} (estoque: ${doce.estoque_itens})`;
    selectDoceReposicao.appendChild(option);
  });
}

function renderVendas() {
  listaVendas.innerHTML = "";

  if (state.vendas.length === 0) {
    listaVendas.innerHTML = "<li>Nenhuma venda registrada.</li>";
    return;
  }

  state.vendas.forEach((venda) => {
    const item = document.createElement("li");
    const data = new Date(venda.data).toLocaleString("pt-BR");

    item.textContent = `${data} — ${venda.doceNome}: ${venda.quantidade} item(ns) | Total ${formatCurrency(
      venda.valorTotal
    )}`;
    listaVendas.appendChild(item);
  });
}

function renderDashboard() {
  const itensEstoque = state.doces.reduce((total, doce) => total + doce.estoque_itens, 0);
  const itensVendidos = state.vendas.reduce((total, venda) => total + venda.quantidade, 0);
  const faturamento = state.vendas.reduce((total, venda) => total + venda.valorTotal, 0);

  mEstoque.textContent = String(itensEstoque);
  mVendidos.textContent = String(itensVendidos);
  mFaturamento.textContent = formatCurrency(faturamento);
  mDoces.textContent = String(state.doces.length);

  resumoEstoque.innerHTML = "";

  if (state.doces.length === 0) {
    resumoEstoque.innerHTML = "<li>Nenhum doce no estoque.</li>";
    return;
  }

  state.doces.forEach((doce) => {
    const item = document.createElement("li");

    const sacosInteiros = Math.floor(doce.estoque_itens / doce.itens_por_saco);
    const itensAvulsos = doce.estoque_itens % doce.itens_por_saco;

    item.textContent = `${doce.nome}: ${doce.estoque_itens} itens (${sacosInteiros} saco(s) + ${itensAvulsos} item(ns))`;
    resumoEstoque.appendChild(item);
  });
}

// function loadState() {
//   const raw = localStorage.getItem(STORAGE_KEY);

//   if (!raw) {
//     return { doces: [], vendas: [] };
//   }

//   try {
//     return JSON.parse(raw);
//   } catch {
//     return { doces: [], vendas: [] };
//   }
// }

function exportarParaExcel() {
  if (!window.XLSX) {
    alert("Não foi possível exportar em Excel agora. Recarregue a página e tente novamente.");
    return;
  }

  const itensEstoque = state.doces.reduce((total, doce) => total + doce.estoque_itens, 0);
  const itensVendidos = state.vendas.reduce((total, venda) => total + venda.quantidade, 0);
  const faturamento = state.vendas.reduce((total, venda) => total + venda.valorTotal, 0);

  const resumo = [
    { Indicador: "Doces cadastrados", Valor: state.doces.length },
    { Indicador: "Itens em estoque", Valor: itensEstoque },
    { Indicador: "Itens vendidos", Valor: itensVendidos },
    { Indicador: "Faturamento (R$)", Valor: Number(faturamento.toFixed(2)) },
    { Indicador: "Gerado em", Valor: new Date().toLocaleString("pt-BR") },
  ];

  const estoque = state.doces.map((doce) => ({
    Doce: doce.nome,
    Sacos: doce.qtd_sacos,
    "Itens por saco": doce.itens_por_saco,
    "Itens em estoque": doce.estoque_itens,
    "Preço por item (R$)": Number(Number(doce.preco_item).toFixed(2)),
  }));

  const vendas = state.vendas.map((venda) => ({
    Data: new Date(venda.data).toLocaleString("pt-BR"),
    Doce: venda.doceNome,
    Quantidade: venda.quantidade,
    "Valor total (R$)": Number(venda.valorTotal.toFixed(2)),
  }));

  const workbook = XLSX.utils.book_new();
  const wsResumo = XLSX.utils.json_to_sheet(resumo);
  const wsEstoque = XLSX.utils.json_to_sheet(estoque.length ? estoque : [{ Aviso: "Nenhum doce cadastrado" }]);
  const wsVendas = XLSX.utils.json_to_sheet(vendas.length ? vendas : [{ Aviso: "Nenhuma venda registrada" }]);

  XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo");
  XLSX.utils.book_append_sheet(workbook, wsEstoque, "Estoque");
  XLSX.utils.book_append_sheet(workbook, wsVendas, "Vendas");

  const agora = new Date();
  const dataArquivo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(
    agora.getDate()
  ).padStart(2, "0")}`;

  XLSX.writeFile(workbook, `estoque-doces-${dataArquivo}.xlsx`);
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
