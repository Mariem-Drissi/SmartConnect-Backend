ALTER TABLE "clients" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "products" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "sale_orders" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sale_orders" ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "sale_order_items" ADD COLUMN "productName" TEXT;
UPDATE "sale_order_items" items
SET "productName" = products."name"
FROM "products" products
WHERE items."productId" = products."id";
ALTER TABLE "sale_order_items" ALTER COLUMN "productName" SET NOT NULL;
ALTER TABLE "sale_order_items" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "sale_order_items" DROP CONSTRAINT "sale_order_items_productId_fkey";
ALTER TABLE "sale_order_items"
  ADD CONSTRAINT "sale_order_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;