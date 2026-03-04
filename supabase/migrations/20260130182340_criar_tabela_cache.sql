-- Cria a tabela de cache se ela não existir
create table if not exists produtos_cache (
  sku text primary key,
  nome text,
  estoque int,
  ultima_atualizacao timestamptz default now()
);

-- Adiciona a coluna parent_sku na tabela de cache
ALTER TABLE produtos_cache 
ADD COLUMN IF NOT EXISTS parent_sku text DEFAULT '0';

-- Habilita segurança (RLS)
alter table produtos_cache enable row level security;

-- Cria uma política permitindo que qualquer um (ou sua API) leia e escreva
-- (Para produção seria ideal restringir, mas para seu teste agora libera tudo)
create policy "Acesso Total" on produtos_cache
for all
using (true)
with check (true);