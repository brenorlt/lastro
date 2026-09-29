-- AlterTable: users — CPF/CNPJ, exigido pela AbacatePay para emitir boleto.
ALTER TABLE "users" ADD COLUMN "tax_id" VARCHAR(14);
