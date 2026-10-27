-- Número sequencial do pedido (#1, #2, …), mostrado ao cliente e no admin.
-- O id CK-… continua como chave interna (evita duplicar no clique duplo); o número é reservado quando o cliente
-- chega na revisão, para já ir na mensagem do WhatsApp. Reserva sem pedido enviado deixa um número sem uso.

create sequence pedidos_numero_seq;

create table reservas_numero (
  chave text primary key,
  numero int not null unique,
  criado_em timestamptz not null default now()
);
comment on table reservas_numero is 'Número reservado para cada pedido em revisão (chave = id interno CK-…).';

alter table pedidos add column numero int unique;
comment on column pedidos.numero is 'Número do pedido mostrado ao cliente e na loja (#numero). Os históricos são 1 a 8.';

update pedidos set numero = id::int where id ~ '^[0-9]+$';
select setval('pedidos_numero_seq', coalesce((select max(numero) from pedidos), 0) + 1, false);
