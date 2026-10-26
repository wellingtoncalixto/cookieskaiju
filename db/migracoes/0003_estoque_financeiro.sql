-- Estoque por sabor e despesas (financeiro).

alter table produtos add column estoque int check (estoque >= 0);
comment on column produtos.estoque is 'Unidades prontas para vender. Nulo = não controla estoque. Zero = esgotado no site.';

create table movimentos_estoque (
  id serial primary key,
  produto_id int not null references produtos (id) on delete cascade,
  quantidade int not null,
  motivo text not null check (motivo in ('venda', 'cancelamento', 'ajuste')),
  pedido_id text references pedidos (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index movimentos_estoque_pedido on movimentos_estoque (pedido_id);
comment on table movimentos_estoque is 'Entradas (+) e saídas (−) de estoque: venda (pedido do site), cancelamento (devolução) e ajuste (contagem no admin).';

alter table pedidos add column sem_estoque boolean not null default false;
comment on column pedidos.sem_estoque is 'O pedido chegou quando não havia unidades suficientes (dois clientes ao mesmo tempo): resolver pelo WhatsApp.';

create table despesas (
  id serial primary key,
  data date not null,
  categoria text not null,
  descricao text not null default '',
  valor numeric(10, 2) not null check (valor >= 0),
  criado_em timestamptz not null default now()
);
create index despesas_data on despesas (data);
comment on table despesas is 'Gastos que não são de um pedido (compra de insumos, embalagens, anúncios, gás/energia…). Resultado = contribuição dos pedidos − despesas.';
