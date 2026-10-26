-- Chave abrir/fechar do delivery (admin → Operação). Uma linha só.
create table estado_loja (
  id boolean primary key default true check (id),
  modo text not null default 'automatico' check (modo in ('automatico', 'aberto', 'fechado')),
  atualizado_em timestamptz not null default now()
);
insert into estado_loja default values;
comment on table estado_loja is 'automatico = segue o calendário; fechado = só agendamento; aberto = libera pedido para hoje.';
