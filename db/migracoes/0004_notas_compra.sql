-- Notas e cupons fiscais de compras da loja, lidos por IA e conferidos no admin.

create table notas_compra (
  id serial primary key,
  criado_em timestamptz not null default now(),
  arquivo_nome text not null default '',
  fornecedor text not null default '',
  data date,
  total numeric(10, 2),
  categoria text not null default 'Insumos',
  status text not null default 'rascunho' check (status in ('rascunho', 'aplicada', 'descartada')),
  aplicada_em timestamptz,
  observacao text not null default ''
);
comment on table notas_compra is 'Notas/cupons de compra enviados no admin. rascunho = lida pela IA, aguardando conferência; aplicada = preços dos insumos atualizados e despesa lançada.';

create table itens_nota (
  id serial primary key,
  nota_id int not null references notas_compra (id) on delete cascade,
  ordem int not null default 0,
  descricao text not null,
  quantidade numeric(12, 3) not null default 1,
  tamanho_embalagem numeric(12, 3),
  unidade text check (unidade in ('g', 'ml', 'un')),
  valor_total numeric(10, 2) not null default 0,
  insumo_id int references insumos (id) on delete set null,
  atualizar_preco boolean not null default true
);
create index itens_nota_nota on itens_nota (nota_id);
comment on column itens_nota.quantidade is 'Quantas embalagens foram compradas.';
comment on column itens_nota.tamanho_embalagem is 'Conteúdo de UMA embalagem, na unidade (g, ml ou un).';
comment on column itens_nota.valor_total is 'Valor pago pela linha (todas as embalagens), já com desconto.';

alter table despesas add column nota_id int references notas_compra (id) on delete set null;
