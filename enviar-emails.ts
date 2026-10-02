// ============================================================
// FUNÇÃO "enviar-emails" (roda no Supabase, não no seu site)
// ============================================================
// Onde colar: no painel do Supabase, menu "Edge Functions",
// "Deploy a new function", nome EXATO: enviar-emails
// Apague o código de exemplo, cole este arquivo inteiro e clique
// em "Deploy". Depois, nas configurações dessa função, deixe
// DESLIGADA a opção "Verify JWT" (a própria função já confere
// quem está chamando, mais abaixo).
//
// A chave do Resend NÃO fica aqui. Ela vive como segredo do
// Supabase, com o nome RESEND_API_KEY (menu Edge Functions,
// "Secrets"). Este código só LÊ o segredo, nunca guarda a chave.
//
// Segredo opcional: EMAIL_REMETENTE, por exemplo
//   Ana Julia Macena <contato@seudominio.com>
// Sem ele, a função usa o remetente de teste do Resend, que só
// entrega para o seu próprio e-mail.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_DONA = "anajuliarmacena@gmail.com";
const MAX_POR_CHAMADA = 250;
const ESPERA_ENTRE_ENVIOS_MS = 200;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// "Pousada Sunset Itacaré" vira "Pousada" em {{nome}}
function primeiroNome(marca: string) {
  return (marca || "").trim().split(/\s+/)[0] || "";
}

function trocarVariaveis(texto: string, marca: string, nome: string, escapar: boolean) {
  const m = escapar ? escaparHtml(marca) : marca;
  const n = escapar ? escaparHtml(nome) : nome;
  return texto.replace(/\{\{\s*nome\s*\}\}/gi, n).replace(/\{\{\s*marca\s*\}\}/gi, m);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ erro: "Método não permitido." }, 405);

  const urlSupabase = Deno.env.get("SUPABASE_URL") ?? "";
  const chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const chaveResend = Deno.env.get("RESEND_API_KEY") ?? "";
  const remetente = Deno.env.get("EMAIL_REMETENTE") ?? "Ana Julia Macena <onboarding@resend.dev>";

  if (!chaveResend) {
    return responder({
      erro: "A chave do Resend ainda não foi colada no Supabase (segredo RESEND_API_KEY).",
      codigo: "sem_chave",
    }, 500);
  }

  const banco = createClient(urlSupabase, chaveServico, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Só a dona do painel passa
  const cabecalho = req.headers.get("Authorization") ?? "";
  const token = cabecalho.replace(/^Bearer\s+/i, "").trim();
  if (!token) return responder({ erro: "Você precisa estar logada.", codigo: "sem_login" }, 401);
  const { data: dadosUsuario, error: erroUsuario } = await banco.auth.getUser(token);
  const emailLogado = (dadosUsuario?.user?.email ?? "").toLowerCase();
  if (erroUsuario || emailLogado !== EMAIL_DONA) {
    return responder({ erro: "Sem permissão.", codigo: "sem_permissao" }, 403);
  }

  // 2) Lê o pedido
  let pedido: any;
  try {
    pedido = await req.json();
  } catch {
    return responder({ erro: "Pedido inválido." }, 400);
  }
  const assuntoModelo = String(pedido?.assunto ?? "").trim();
  const htmlModelo = String(pedido?.html ?? "");
  const ehTeste = pedido?.teste === true;
  const pularJaEnviados = pedido?.pular_ja_enviados === true;
  const lista: { email: string; marca: string }[] = Array.isArray(pedido?.destinatarios)
    ? pedido.destinatarios
    : [];

  if (!assuntoModelo || !htmlModelo.trim()) {
    return responder({ erro: "Faltou assunto ou texto do e-mail." }, 400);
  }
  if (lista.length === 0) return responder({ erro: "Nenhum destinatário." }, 400);
  if (lista.length > MAX_POR_CHAMADA) {
    return responder({ erro: `No máximo ${MAX_POR_CHAMADA} destinatários por chamada.` }, 400);
  }

  // 3) Tira repetidos (mesmo e-mail só uma vez)
  const vistos = new Set<string>();
  const unicos: { email: string; marca: string }[] = [];
  let pulados = 0;
  for (const item of lista) {
    const email = String(item?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || vistos.has(email)) {
      pulados++;
      continue;
    }
    vistos.add(email);
    unicos.push({ email, marca: String(item?.marca ?? "").trim() });
  }

  // 4) Tira quem pediu pra sair e (se ligado) quem já recebeu esse assunto
  let descadastrados = new Set<string>();
  let jaReceberam = new Set<string>();
  if (!ehTeste) {
    const emails = unicos.map((u) => u.email);
    const resOptout = await banco.from("email_optout").select("email").in("email", emails);
    if (resOptout.error) {
      return responder({
        erro: "Não consegui ler a tabela email_optout. Rode o disparo.sql no Supabase.",
        codigo: "sem_tabela",
      }, 500);
    }
    descadastrados = new Set((resOptout.data ?? []).map((l: any) => String(l.email).toLowerCase()));

    if (pularJaEnviados) {
      const resEnvios = await banco
        .from("email_envios")
        .select("email, assunto")
        .eq("status", "ok")
        .in("email", emails);
      if (resEnvios.error) {
        return responder({
          erro: "Não consegui ler a tabela email_envios. Rode o disparo.sql no Supabase.",
          codigo: "sem_tabela",
        }, 500);
      }
      jaReceberam = new Set(
        (resEnvios.data ?? []).map((l: any) => `${String(l.email).toLowerCase()}|${l.assunto}`),
      );
    }
  }

  // 5) Envia um por um
  const resultados: { email: string; status: string; erro?: string; id?: string }[] = [];
  let enviados = 0;
  let falhas = 0;
  let cotaAcabou = false;
  let semDominio = false;
  let tentados = 0;

  for (let i = 0; i < unicos.length; i++) {
    const { email, marca } = unicos[i];
    const nome = primeiroNome(marca);
    const assunto = (ehTeste ? "[TESTE] " : "") + trocarVariaveis(assuntoModelo, marca, nome, false);
    const html = trocarVariaveis(htmlModelo, marca, nome, true);

    if (!ehTeste && descadastrados.has(email)) {
      pulados++;
      resultados.push({ email, status: "pulado", erro: "pediu para sair" });
      continue;
    }
    if (!ehTeste && jaReceberam.has(`${email}|${assunto}`)) {
      pulados++;
      resultados.push({ email, status: "pulado", erro: "já recebeu esse assunto" });
      continue;
    }

    if (tentados > 0) await esperar(ESPERA_ENTRE_ENVIOS_MS);
    tentados++;

    let resposta: Response;
    let corpo: any = {};
    try {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        resposta = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${chaveResend}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: remetente,
            to: [email],
            subject: assunto,
            html,
            reply_to: EMAIL_DONA,
            headers: {
              "List-Unsubscribe": `<mailto:${EMAIL_DONA}?subject=SAIR>`,
            },
          }),
        });
        corpo = await resposta.json().catch(() => ({}));
        // Limite de velocidade (não é o limite do dia): espera e tenta de novo uma vez
        if (resposta.status === 429 && corpo?.name === "rate_limit_exceeded" && tentativa === 0) {
          await esperar(1200);
          continue;
        }
        break;
      }
    } catch (erroRede) {
      falhas++;
      const msg = `Falha de conexão com o Resend: ${(erroRede as Error).message}`;
      resultados.push({ email, status: "erro", erro: msg });
      if (!ehTeste) {
        await banco.from("email_envios").insert({ email, assunto, status: "erro", erro: msg });
      }
      continue;
    }

    if (resposta!.ok) {
      enviados++;
      resultados.push({ email, status: "ok", id: corpo?.id });
      if (!ehTeste) {
        await banco.from("email_envios").insert({
          email, assunto, status: "ok", resend_id: corpo?.id ?? null,
        });
      }
      continue;
    }

    const nomeErro = String(corpo?.name ?? "");
    const mensagem = String(corpo?.message ?? `Erro ${resposta!.status}`);

    // Acabou o limite diário: PARA na hora, sem tentar mais nenhum
    if (nomeErro === "daily_quota_exceeded" || nomeErro === "monthly_quota_exceeded") {
      cotaAcabou = true;
      resultados.push({ email, status: "nao_enviado", erro: "limite diário do Resend acabou" });
      break;
    }

    falhas++;
    resultados.push({ email, status: "erro", erro: mensagem });
    if (!ehTeste) {
      await banco.from("email_envios").insert({ email, assunto, status: "erro", erro: mensagem });
    }

    // Sem domínio verificado o Resend só entrega para o seu próprio e-mail.
    // Continuar só geraria uma montanha de erros iguais, então para.
    if (/own email address|verify a domain|verify your domain/i.test(mensagem)) {
      semDominio = true;
      break;
    }
  }

  const processados = resultados.length;
  const restantes = unicos.length - processados + (cotaAcabou ? 1 : 0);

  return responder({
    enviados,
    falhas,
    pulados,
    cota_acabou: cotaAcabou,
    sem_dominio: semDominio,
    restantes: cotaAcabou || semDominio ? restantes : 0,
    resultados,
    teste: ehTeste,
  });
});
