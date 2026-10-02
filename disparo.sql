-- ============================================================
-- TABELAS DA ABA PROSPECÇÃO (disparo de e-mails)
-- ============================================================
-- Onde colar: entre no seu projeto em supabase.com, no menu da
-- esquerda clique em "SQL Editor", depois em "New query", cole
-- este arquivo inteiro e clique em "Run" (ou Ctrl+Enter).
--
-- É seguro rodar mais de uma vez: nada que já existe é apagado
-- nem recriado. Só entram coisas novas.
-- ============================================================


-- ------------------------------------------------------------
-- 1) COLUNA "selecionada" NA TABELA "marcas"
-- ------------------------------------------------------------
-- É o quadradinho que você marca na aba Marcas pra dizer "essa
-- marca vai receber o próximo e-mail". Fica salvo no banco, então
-- a seleção continua lá mesmo se você fechar o painel.
alter table public.marcas add column if not exists selecionada boolean not null default false;


-- ------------------------------------------------------------
-- 2) TABELA "email_envios" (o histórico de cada envio)
-- ------------------------------------------------------------
-- Uma linha pra cada e-mail enviado (ou que tentou enviar):
--   email     = pra quem foi
--   assunto   = o assunto que a pessoa recebeu
--   status    = 'ok' (saiu) ou 'erro' (não saiu)
--   erro      = o motivo, quando deu erro
--   resend_id = o código que o Resend dá pra cada e-mail
--   criado_em = quando foi
create table if not exists public.email_envios (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  assunto    text not null,
  status     text not null check (status in ('ok', 'erro')),
  erro       text,
  resend_id  text,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_email_envios_email on public.email_envios (email);
create index if not exists idx_email_envios_criado_em on public.email_envios (criado_em);


-- ------------------------------------------------------------
-- 3) TABELA "email_optout" (quem pediu pra sair)
-- ------------------------------------------------------------
-- Quem está aqui nunca mais recebe e-mail seu, em disparo nenhum.
-- Quando alguém responder SAIR, você coloca o e-mail da pessoa
-- aqui pela própria aba Prospecção (caixa "Quem pediu pra sair").
create table if not exists public.email_optout (
  email      text primary key,
  criado_em  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 4) TRAVA DE SEGURANÇA (RLS): SÓ VOCÊ, LOGADA, LÊ E ESCREVE
-- ------------------------------------------------------------
-- Nenhum visitante do site consegue ver nem mexer nessas duas
-- tabelas. Só a sessão logada com o seu e-mail passa.
alter table public.email_envios enable row level security;
alter table public.email_optout enable row level security;

drop policy if exists "dono_tudo_email_envios" on public.email_envios;
create policy "dono_tudo_email_envios"
  on public.email_envios
  for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'anajuliarmacena@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'anajuliarmacena@gmail.com');

drop policy if exists "dono_tudo_email_optout" on public.email_optout;
create policy "dono_tudo_email_optout"
  on public.email_optout
  for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'anajuliarmacena@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'anajuliarmacena@gmail.com');


-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
