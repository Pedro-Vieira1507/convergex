create table if not exists pedidos_cache (
  id text primary key, -- orderid
  numero_pedido text,
  data_pedido timestamptz,
  status text, -- statusdescription (ex: SHIPPED)
  cliente_nome text,
  valor_total decimal,
  nota_fiscal text, -- invoicenumber
  rastreio_codigo text, -- trackingcode
  transportadora text, -- carrier
  xml_nfe text, -- para extrair detalhes se precisar
  ultima_atualizacao timestamptz default now()
);

-- Habilita acesso
alter table pedidos_cache enable row level security;
create policy "Acesso Total Pedidos" on pedidos_cache for all using (true) with check (true);