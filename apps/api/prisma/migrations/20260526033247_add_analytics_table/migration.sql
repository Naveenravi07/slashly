-- CreateTable
CREATE TABLE "UrlAnalytics" (
    "id" BIGSERIAL NOT NULL,
    "url_id" BIGINT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "country" TEXT,
    "city" TEXT,
    "device_type" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrlAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UrlAnalytics_url_id_idx" ON "UrlAnalytics"("url_id");

-- CreateIndex
CREATE INDEX "UrlAnalytics_clicked_at_idx" ON "UrlAnalytics"("clicked_at");

-- CreateIndex
CREATE INDEX "UrlAnalytics_country_idx" ON "UrlAnalytics"("country");

-- CreateIndex
CREATE INDEX "UrlAnalytics_device_type_idx" ON "UrlAnalytics"("device_type");

-- AddForeignKey
ALTER TABLE "UrlAnalytics" ADD CONSTRAINT "UrlAnalytics_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;
