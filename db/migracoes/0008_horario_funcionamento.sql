-- Horário de funcionamento por dia da semana (admin → Horário) e fim do "abre mais tarde".
-- Pode rodar de novo sem estragar nada (if not exists / on conflict).

-- 1) Um horário por dia: aberto ou não, abre e fecha em minutos desde 0h (São Paulo), de 30 em 30.
--    Nos dias fechados, as horas ficam guardadas para quando o dia voltar a abrir.
create table if not exists horario_funcionamento (
  dia_semana smallint primary key check (dia_semana between 0 and 6),
  aberto boolean not null default false,
  abre_min int not null check (abre_min between 0 and 1440 and abre_min % 30 = 0),
  fecha_min int not null check (fecha_min between 0 and 1440 and fecha_min % 30 = 0),
  atualizado_em timestamptz not null default now(),
  constraint horario_funcionamento_fecha_check check (not aberto or fecha_min >= abre_min + 60)
);
comment on table horario_funcionamento is
  'Horário de funcionamento: dia_semana 0 = domingo … 6 = sábado; abre_min/fecha_min em minutos desde 0h (São Paulo).';

-- Valor inicial: o que vale hoje (sábado e domingo, das 13h às 18h).
insert into horario_funcionamento (dia_semana, aberto, abre_min, fecha_min) values
  (0, true, 780, 1080),
  (1, false, 780, 1080),
  (2, false, 780, 1080),
  (3, false, 780, 1080),
  (4, false, 780, 1080),
  (5, false, 780, 1080),
  (6, true, 780, 1080)
on conflict (dia_semana) do nothing;

-- 2) Modo da loja: automático (pelo horário) ou manual ("aberto"/"fechado", volta ao automático à meia-noite).
--    O "abre mais tarde" sai: quem estava nele passa a seguir o horário.
update estado_loja set modo = 'automatico', atualizado_em = now() where modo = 'mais_tarde';
alter table estado_loja drop constraint if exists estado_loja_modo_check;
alter table estado_loja add constraint estado_loja_modo_check check (modo in ('automatico', 'aberto', 'fechado'));
alter table estado_loja drop column if exists abre_as;
comment on table estado_loja is
  'automatico = segue o horário de funcionamento; aberto/fechado = manual, vale só no dia (São Paulo) em que foi escolhido.';
