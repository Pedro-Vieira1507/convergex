ALTER TABLE produtos_cache 
ADD COLUMN IF NOT EXISTS parent_sku text DEFAULT '0';