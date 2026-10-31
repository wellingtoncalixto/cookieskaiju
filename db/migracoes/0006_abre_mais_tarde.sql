-- Modo "abre mais tarde": fechado agora, mas aceita agendamento nas faixas que ainda restam hoje.
alter table estado_loja drop constraint if exists estado_loja_modo_check;
alter table estado_loja add constraint estado_loja_modo_check
  check (modo in ('automatico', 'aberto', 'fechado', 'mais_tarde'));
comment on table estado_loja is 'automatico = segue o calendário; fechado = só agendamento; aberto = libera pedido para hoje; mais_tarde = fechado agora, agenda faixas de hoje (só vale no dia em que foi escolhido).';
