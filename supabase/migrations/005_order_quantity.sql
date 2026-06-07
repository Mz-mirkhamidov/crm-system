-- Remove product check constraint (multi-product orders)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_product_check;

-- Add quantity field
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;

-- Allow multi-product text in product field
-- Now product can be: "AJR Sedan (2), AJR Kids (1)"
