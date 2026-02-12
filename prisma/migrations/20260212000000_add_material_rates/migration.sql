-- CreateTable
CREATE TABLE "MaterialRate" (
    "id" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "unit" TEXT,
    "rate" DOUBLE PRECISION,
    "currency" TEXT,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRate_pkey" PRIMARY KEY ("id")
);

