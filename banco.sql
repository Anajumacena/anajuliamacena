-- ============================================================
-- BANCO DE DADOS DO PAINEL DA ANA JULIA MACENA
-- ============================================================
-- Onde colar: entre no seu projeto em supabase.com, no menu da
-- esquerda clique em "SQL Editor", depois em "New query", cole
-- este arquivo inteiro e clique em "Run" (ou aperte Ctrl+Enter).
-- Pode rodar esse script mais de uma vez sem quebrar nada: ele
-- sempre apaga a versão antiga de cada regra antes de recriar.
-- ============================================================


-- ------------------------------------------------------------
-- 1) EXTENSÃO PRA GERAR OS CÓDIGOS (ID) DE CADA LINHA
-- ------------------------------------------------------------
-- Cada linha de cada tabela precisa de um código único (um "id").
-- Essa extensão liga a função que cria esse código sozinha.
create extension if not exists pgcrypto;


-- ------------------------------------------------------------
-- 2) TABELA "videos"
-- ------------------------------------------------------------
-- Guarda cada vídeo que aparece no seu portfólio público.
-- "ordem" decide a posição do vídeo na tela (menor número
-- aparece primeiro). "visivel" é o olhinho que liga e desliga
-- o vídeo do site sem precisar apagar a linha.
create table if not exists public.videos (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  link       text not null,
  nicho      text not null,
  formato    text not null default 'Vídeo vertical 9:16',
  marca      text,
  destaque   text,
  ordem      integer not null default 0,
  visivel    boolean not null default true,
  criado_em  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 3) TABELA "marcas"
-- ------------------------------------------------------------
-- É a sua base de contatos de empresa (o CRM). "situacao" conta
-- em que pé está a conversa com aquela marca.
create table if not exists public.marcas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  instagram       text,
  email           text,
  telefone        text,
  situacao        text not null default 'lead'
                    check (situacao in ('lead', 'conversando', 'cliente', 'parada')),
  obs             text,
  ultimo_contato  date,
  criado_em       timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 4) TABELA "calendario"
-- ------------------------------------------------------------
-- É a sua agenda de tarefas: o que precisa gravar, editar ou
-- postar, em que dia, e se já foi feito.
create table if not exists public.calendario (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  marca      text,
  tipo       text not null default 'gravar'
               check (tipo in ('gravar', 'editar', 'postar')),
  data       date not null,
  status     text not null default 'a fazer'
               check (status in ('a fazer', 'feito')),
  criado_em  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 5) TABELA "campanhas"
-- ------------------------------------------------------------
-- É o controle financeiro dos seus trabalhos com marcas.
-- "status" segue a ordem do funil (Briefing até Entregue).
-- "pagamento" diz se o dinheiro daquele trabalho já caiu.
create table if not exists public.campanhas (
  id         uuid primary key default gen_random_uuid(),
  campanha   text not null,
  cliente    text not null,
  tipo       text not null default 'Conteúdo'
               check (tipo in ('Conteúdo', 'Publicidade')),
  status     text not null default 'Briefing'
               check (status in (
                 'Briefing', 'Roteiro', 'Aprovação Roteiro',
                 'Gravação', 'Edição', 'Aprovado', 'Entregue'
               )),
  qtd        integer not null default 1,
  valor      numeric(10,2) not null default 0,
  prazo      date,
  pagamento  text not null default 'pendente'
               check (pagamento in ('pendente', 'pago')),
  ativa      boolean not null default true,
  favorita   boolean not null default false,
  criado_em  timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 6) TABELA "marcados"
-- ------------------------------------------------------------
-- Guarda quais itens do checklist do portfólio você já marcou
-- como feito. Cada item do checklist tem uma "chave" de texto
-- (por exemplo "capa-0"), e essa tabela só lembra se ela está
-- marcada ou não.
create table if not exists public.marcados (
  chave         text primary key,
  marcado       boolean not null default true,
  atualizado_em timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 7) TABELA "visitas"
-- ------------------------------------------------------------
-- Um registro simples de quem passou pelo seu portfólio, só pra
-- alimentar os números do painel. Não guarda nome nem nenhum
-- dado pessoal do visitante.
create table if not exists public.visitas (
  id       uuid primary key default gen_random_uuid(),
  data     timestamptz not null default now(),
  pagina   text,
  origem   text
);

-- Esses dois índices só deixam o painel mais rápido quando a
-- lista de visitas e a agenda começarem a crescer.
create index if not exists idx_visitas_data on public.visitas (data);
create index if not exists idx_calendario_data on public.calendario (data);


-- ============================================================
-- 8) LIGANDO A TRAVA DE SEGURANÇA (RLS) EM TODAS AS TABELAS
-- ============================================================
-- RLS quer dizer "Row Level Security", ou seja: mesmo com a
-- chave pública em mãos, ninguém consegue ler ou escrever nada
-- se não houver uma regra abaixo permitindo. É a trava que
-- protege os seus dados mesmo com o site sendo público.
alter table public.videos     enable row level security;
alter table public.marcas     enable row level security;
alter table public.calendario enable row level security;
alter table public.campanhas  enable row level security;
alter table public.marcados   enable row level security;
alter table public.visitas    enable row level security;


-- ============================================================
-- 9) REGRAS DE ACESSO (POLÍTICAS)
-- ============================================================
-- Regra geral do painel: só quem está logado com a sua conta
-- pode ler ou escrever. O Supabase só entrega o papel
-- "authenticated" pra quem fez login de verdade, então checar
-- "to authenticated" já garante que é você.
--
-- Duas exceções, exatamente como pedido:
--   a) qualquer visitante pode INSERIR uma linha em "marcas"
--      (o formulário de contato do site), sempre como "lead";
--   b) qualquer visitante pode INSERIR uma linha em "visitas"
--      (o registro de visita do site).
-- Fora essas duas portas, ninguém deslogado lê ou escreve nada.
--
-- Exceção extra, necessária pro site funcionar: os vídeos com
-- "visivel = true" também podem ser LIDOS por qualquer pessoa,
-- porque é isso que aparece no seu portfólio público. Vídeos
-- escondidos (visivel = false) continuam só seus.

-- ---------- videos ----------
drop policy if exists "dono_tudo_videos" on public.videos;
create policy "dono_tudo_videos"
  on public.videos
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "publico_le_videos_visiveis" on public.videos;
create policy "publico_le_videos_visiveis"
  on public.videos
  for select
  to anon
  using (visivel = true);

-- ---------- marcas ----------
drop policy if exists "dono_tudo_marcas" on public.marcas;
create policy "dono_tudo_marcas"
  on public.marcas
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "publico_insere_lead" on public.marcas;
create policy "publico_insere_lead"
  on public.marcas
  for insert
  to anon
  with check (situacao = 'lead');

-- ---------- calendario ----------
drop policy if exists "dono_tudo_calendario" on public.calendario;
create policy "dono_tudo_calendario"
  on public.calendario
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------- campanhas ----------
drop policy if exists "dono_tudo_campanhas" on public.campanhas;
create policy "dono_tudo_campanhas"
  on public.campanhas
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------- marcados ----------
drop policy if exists "dono_tudo_marcados" on public.marcados;
create policy "dono_tudo_marcados"
  on public.marcados
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------- visitas ----------
drop policy if exists "dono_le_visitas" on public.visitas;
create policy "dono_le_visitas"
  on public.visitas
  for select
  to authenticated
  using (true);

drop policy if exists "publico_insere_visita" on public.visitas;
create policy "publico_insere_visita"
  on public.visitas
  for insert
  to anon
  with check (true);


-- ============================================================
-- 10) UMA LINHA DE EXEMPLO EM CADA LISTA
-- ============================================================
-- Só pra você ver o formato de cada tabela pronta. Todas
-- começam com "Exemplo:" no nome pra ficar claro que é pra
-- apagar. O vídeo de exemplo já entra escondido (visivel =
-- false) pra nunca aparecer no seu site de verdade.
-- "visitas" não ganha exemplo: o combinado é começar do zero.

insert into public.videos (titulo, link, nicho, formato, marca, destaque, ordem, visivel)
values (
  'Exemplo: troque por um vídeo seu',
  'https://youtube.com/shorts/exemplo',
  'exemplo',
  'Vídeo vertical 9:16',
  'Marca Exemplo',
  '0 views',
  0,
  false
);

insert into public.marcas (nome, instagram, email, telefone, situacao, obs, ultimo_contato)
values (
  'Exemplo: apague esta linha',
  '@marcaexemplo',
  'exemplo@email.com',
  '(00) 00000-0000',
  'lead',
  'Isso é só um exemplo do formato desta lista. Pode apagar.',
  current_date
);

insert into public.calendario (titulo, marca, tipo, data, status)
values (
  'Exemplo: apague este evento',
  'Marca Exemplo',
  'gravar',
  current_date,
  'a fazer'
);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita)
values (
  'Exemplo: apague esta campanha',
  'Cliente Exemplo',
  'Conteúdo',
  'Briefing',
  1,
  0,
  current_date,
  'pendente',
  true,
  false
);


-- ============================================================
-- 11) CAMPO "capa" NA TABELA "videos"
-- ============================================================
-- Guarda o link de uma foto de capa escolhida por você pra cada
-- vídeo. Quando esse campo está vazio, o site mostra um degradê
-- no lugar (nunca quebra por falta de capa).
alter table public.videos add column if not exists capa text;


-- ============================================================
-- 12) CAMPO "projeto_descricao" NA TABELA "videos"
-- ============================================================
-- Usado só na seção Branded Content: uma frase curta contando o
-- que foi aquele projeto com a marca. Preencha em pelo menos um
-- vídeo de cada marca (se preencher em mais de um, o site usa o
-- primeiro que encontrar).
alter table public.videos add column if not exists projeto_descricao text;


-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
