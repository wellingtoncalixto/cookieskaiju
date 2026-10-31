-- "Abre mais tarde" com hora marcada (minutos do dia, horário de São Paulo). Null = sem hora.
alter table estado_loja add column if not exists abre_as int check (abre_as between 0 and 1439);
