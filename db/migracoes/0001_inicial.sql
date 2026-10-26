-- Cookies Kaiju: esquema inicial (substitui o Painel Comercial e a planilha de precificação).
-- Sem dados pessoais: nenhum nome, telefone, endereço ou mensagem de cliente é guardado.
-- Valores em reais; datas e horas de pedidos em America/Sao_Paulo.

-- ---------------------------------------------------------------- precificação

create table insumos (
  id serial primary key,
  nome text not null unique,
  unidade text not null check (unidade in ('g', 'ml', 'un')),
  embalagem_qtd numeric(12, 3) not null check (embalagem_qtd > 0),
  embalagem_preco numeric(12, 2) not null check (embalagem_preco >= 0),
  atualizado_em timestamptz not null default now()
);
comment on table insumos is 'Ingredientes e embalagens comprados. Custo por unidade = embalagem_preco / embalagem_qtd.';

create table receitas (
  id serial primary key,
  nome text not null unique,
  tipo text not null check (tipo in ('sabor', 'base')),
  rendimento numeric(12, 3) not null check (rendimento > 0),
  unidade_rendimento text not null check (unidade_rendimento in ('un', 'g')),
  mao_de_obra_pct numeric(6, 4) not null default 0 check (mao_de_obra_pct >= 0),
  usa_forno boolean not null default false,
  atualizado_em timestamptz not null default now()
);
comment on table receitas is 'Receitas. tipo=base (ex.: massa) entra em outras receitas por grama; tipo=sabor gera um produto. Mão de obra % aplica-se só ao sabor.';
comment on column receitas.usa_forno is 'Soma a energia do forno elétrico (parâmetros forno_* da configuração), por fornada.';

create table receita_ingredientes (
  id serial primary key,
  receita_id int not null references receitas (id) on delete cascade,
  insumo_id int references insumos (id) on delete restrict,
  sub_receita_id int references receitas (id) on delete restrict,
  quantidade numeric(12, 3) not null check (quantidade > 0),
  check ((insumo_id is null) <> (sub_receita_id is null)),
  check (sub_receita_id is null or sub_receita_id <> receita_id)
);
comment on column receita_ingredientes.quantidade is 'Na unidade do insumo, ou na unidade de rendimento da sub-receita (ex.: gramas de massa).';

-- ---------------------------------------------------------------- cardápio

create table produtos (
  id serial primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text not null,
  destaque text not null default '',
  descricao text not null default '',
  alt text not null default '',
  preco numeric(10, 2) not null check (preco >= 0),
  disponivel boolean not null default true,
  ativo boolean not null default true,
  ordem int not null default 0,
  foto_url text,
  cartaz_url text,
  receita_id int references receitas (id) on delete set null,
  custo_unitario numeric(12, 4),
  atualizado_em timestamptz not null default now()
);
comment on table produtos is 'Cardápio do site. ativo=false some do site; disponivel=false aparece como esgotado.';
comment on column produtos.custo_unitario is 'Custo final por cookie (ingredientes + energia + mão de obra), recalculado pelo admin a cada mudança na precificação.';

create table custos_historico (
  id serial primary key,
  produto_id int not null references produtos (id) on delete cascade,
  custo_unitario numeric(12, 4),
  preco numeric(10, 2) not null,
  registrado_em timestamptz not null default now()
);
comment on table custos_historico is 'Custo e preço de cada produto sempre que um dos dois muda.';

-- ---------------------------------------------------------------- parâmetros

create table configuracao (
  chave text primary key,
  valor numeric(14, 6),
  unidade text not null default '',
  nota text not null default ''
);
comment on table configuracao is 'Parâmetros de custo e operação (embalagem, combustível, taxas, forno, validade). valor nulo = ainda não informado (não é zero).';

-- ---------------------------------------------------------------- pedidos

create table pedidos (
  id text primary key,
  criado_em timestamptz not null,
  entrega_data date,
  entrega_faixa text,
  modalidade text check (modalidade in ('entrega', 'retirada')),
  cidade text not null default '',
  distancia_km numeric(8, 1),
  pagamento text check (pagamento in ('pix', 'credito', 'debito', 'dinheiro')),
  status text not null default 'pendente' check (status in ('pendente', 'concluido', 'cancelado', 'abandonado')),
  status_em timestamptz not null default now(),
  quantidade_cookies int not null default 0,
  receita_cookies numeric(10, 2) not null default 0,
  frete numeric(10, 2),
  custo_cookies numeric(12, 4),
  embalagem numeric(10, 4),
  taxa_pagamento numeric(10, 4),
  combustivel numeric(10, 4),
  contribuicao numeric(12, 4),
  origem text not null default 'site',
  relacao_cliente text check (relacao_cliente in ('novo', 'conhecido')),
  como_conheceu text not null default '',
  tipo_registro text not null default 'site' check (tipo_registro in ('site', 'historico', 'manual'))
);
create index pedidos_entrega_data on pedidos (entrega_data);
create index pedidos_criado_em on pedidos (criado_em);
comment on table pedidos is 'Um pedido por linha, sem dados pessoais. Valores calculados no momento do registro (preço e custo do dia).';
comment on column pedidos.id is 'CK-AAMMDD-XXXXXXX para pedidos do site; 1 a 8 para o histórico anterior ao site.';
comment on column pedidos.entrega_data is 'Data da entrega/retirada (para hoje = data do pedido). Nulo no histórico.';
comment on column pedidos.entrega_faixa is 'agora (pedido para hoje, 60–90 min) ou o id da faixa agendada (13h, 14h…).';
comment on column pedidos.frete is 'Frete cobrado. Nulo = a confirmar (sem cotação). 0 = grátis/retirada.';
comment on column pedidos.receita_cookies is 'Soma de quantidade × preço dos itens (sem frete).';
comment on column pedidos.embalagem is 'Sacos kraft (1 a cada 5 cookies) + flyers.';
comment on column pedidos.taxa_pagamento is 'Taxa da maquininha/Pix sobre (cookies + frete).';
comment on column pedidos.combustivel is 'Ida e volta: 2 × km × gasolina ÷ consumo da moto.';
comment on column pedidos.contribuicao is 'Receita + frete − custo dos cookies − embalagem − taxa − combustível. Nulo se faltar algum valor.';
comment on column pedidos.origem is 'site ou pessoal (pedido feito direto com a loja).';
comment on column pedidos.tipo_registro is 'site (automático), historico (anterior ao site) ou manual.';

create table itens_pedido (
  id serial primary key,
  pedido_id text not null references pedidos (id) on delete cascade,
  produto_id int references produtos (id) on delete set null,
  produto_nome text not null,
  quantidade int not null check (quantidade > 0),
  preco_unitario numeric(10, 2) not null,
  custo_unitario numeric(12, 4)
);
create index itens_pedido_pedido on itens_pedido (pedido_id);
comment on table itens_pedido is 'Sabores de cada pedido, com preço e custo do dia do pedido.';

-- ---------------------------------------------------------------- gestão

create table estoque_lotes (
  id serial primary key,
  produto_id int not null references produtos (id) on delete cascade,
  quantidade int check (quantidade >= 0),
  lote text not null default '',
  produzido_em date,
  criado_em timestamptz not null default now()
);
comment on column estoque_lotes.quantidade is 'Nulo = não informado (diferente de zero).';

create table campanhas (
  id serial primary key,
  data date,
  canal text not null default '',
  conteudo text not null default '',
  objetivo text not null default '',
  visualizacoes int,
  interacoes int,
  conversas int,
  pedidos_atribuidos int,
  receita_atribuida numeric(10, 2),
  gasto numeric(10, 2),
  aprendizado text not null default ''
);

create table metas (
  id serial primary key,
  indicador text not null,
  atual text not null default '',
  meta text not null default '',
  observacao text not null default '',
  ordem int not null default 0
);

-- ---------------------------------------------------------------- views (o antigo "Painel")

create view vw_pedidos as
select
  p.*,
  coalesce(p.receita_cookies, 0) + coalesce(p.frete, 0) as total,
  (p.criado_em at time zone 'America/Sao_Paulo') as criado_em_sp
from pedidos p;
comment on view vw_pedidos is 'Pedidos com total (cookies + frete) e data/hora em São Paulo.';

create view vw_estoque as
select
  e.*,
  pr.nome as produto,
  e.produzido_em + (select valor::int from configuracao where chave = 'validade_dias') as validade,
  e.produzido_em + (select valor::int from configuracao where chave = 'validade_dias')
    - (now() at time zone 'America/Sao_Paulo')::date as dias_restantes,
  case
    when e.quantidade is null then 'Não informado'
    when e.produzido_em is null then 'Sem data de lote'
    when e.produzido_em + (select valor::int from configuracao where chave = 'validade_dias')
      < (now() at time zone 'America/Sao_Paulo')::date then 'Vencido'
    when e.produzido_em + (select valor::int from configuracao where chave = 'validade_dias')
      - (now() at time zone 'America/Sao_Paulo')::date <= 15 then 'Revisar vencimento'
    else 'Registrado'
  end as situacao
from estoque_lotes e
join produtos pr on pr.id = e.produto_id;

create view painel_resumo as
select
  (select count(*) from produtos where ativo) as sabores_ativos,
  (select avg(preco) from produtos where ativo) as preco_medio,
  (select avg(custo_unitario) from produtos where ativo) as custo_medio_unitario,
  count(*) filter (where status = 'concluido') as pedidos_concluidos,
  coalesce(sum(receita_cookies) filter (where status = 'concluido'), 0) as receita_cookies_concluidos,
  coalesce(sum(contribuicao) filter (where status = 'concluido'), 0) as contribuicao_concluida,
  coalesce(sum(receita_cookies) filter (where status = 'concluido'), 0)
    / nullif(count(*) filter (where status = 'concluido'), 0) as ticket_medio_cookies
from pedidos;
comment on view painel_resumo is 'Resumo geral (só pedidos concluídos). Contribuição é parcial: manutenção e outros custos não incluídos.';

create view painel_modalidade as
select
  modalidade,
  count(*) as pedidos,
  sum(receita_cookies + coalesce(frete, 0)) as faturamento,
  sum(receita_cookies + coalesce(frete, 0)) / count(*) as ticket_medio,
  sum(contribuicao) as contribuicao,
  sum(contribuicao) / count(*) as contribuicao_media
from pedidos
where status = 'concluido'
group by modalidade;

create view painel_origem as
select origem, count(*) as pedidos, sum(receita_cookies + coalesce(frete, 0)) as faturamento
from pedidos
where status = 'concluido'
group by origem;

create view painel_funil as
select
  count(*) as iniciados,
  count(*) filter (where status = 'pendente') as pendentes,
  coalesce(sum(receita_cookies + coalesce(frete, 0)) filter (where status = 'pendente'), 0) as valor_pendente,
  count(*) filter (where status = 'concluido') as concluidos,
  count(*) filter (where status = 'cancelado') as cancelados,
  count(*) filter (where status = 'abandonado') as abandonados,
  count(*) filter (where status = 'concluido')::numeric / nullif(count(*), 0) as taxa_conclusao
from pedidos
where tipo_registro = 'site';
comment on view painel_funil is 'Pedidos iniciados pelo site (cliques para o WhatsApp; o envio não é confirmado).';

create view painel_vendas_por_sabor as
select
  i.produto_nome as sabor,
  sum(i.quantidade) as cookies,
  sum(i.quantidade * i.preco_unitario) as receita,
  sum(i.quantidade * i.custo_unitario) as custo
from itens_pedido i
join pedidos p on p.id = i.pedido_id
where p.status = 'concluido'
group by i.produto_nome;
