-- Safe migration: bring notification support tables under Prisma management
-- Strategy: CREATE TABLE IF NOT EXISTS + existence checks → 100% idempotent, no data loss

CREATE TABLE IF NOT EXISTS "user_notification_preference" (
    "id"          SERIAL       NOT NULL,
    "id_user"     INTEGER      NOT NULL,
    "tipo_evento" VARCHAR(100) NOT NULL,
    "canal"       VARCHAR(100) NOT NULL,
    "activo"      BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT "user_notification_preference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_push_token" (
    "id_push_token" SERIAL        NOT NULL,
    "id_user"       INTEGER       NOT NULL,
    "token"         VARCHAR(255)  NOT NULL,
    "platform"      VARCHAR(50),
    "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT "user_push_token_pkey" PRIMARY KEY ("id_push_token")
);

CREATE TABLE IF NOT EXISTS "daily_digest_queue" (
    "id"          SERIAL        NOT NULL,
    "id_user"     INTEGER       NOT NULL,
    "mensaje"     TEXT          NOT NULL,
    "tipo_evento" VARCHAR(100),
    "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    "sent"        BOOLEAN       NOT NULL DEFAULT FALSE,
    CONSTRAINT "daily_digest_queue_pkey" PRIMARY KEY ("id")
);

-- Unique constraints: check pg_constraint before adding (avoids duplicate_object / duplicate_table errors)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_notification_preference_id_user_tipo_evento_canal_key'
    ) THEN
        ALTER TABLE "user_notification_preference"
            ADD CONSTRAINT "user_notification_preference_id_user_tipo_evento_canal_key"
            UNIQUE ("id_user", "tipo_evento", "canal");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_push_token_id_user_token_key'
    ) THEN
        ALTER TABLE "user_push_token"
            ADD CONSTRAINT "user_push_token_id_user_token_key"
            UNIQUE ("id_user", "token");
    END IF;
END $$;

-- Foreign key constraints: same idempotent approach
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_notification_preference_id_user_fkey'
    ) THEN
        ALTER TABLE "user_notification_preference"
            ADD CONSTRAINT "user_notification_preference_id_user_fkey"
            FOREIGN KEY ("id_user") REFERENCES "user"("id_user")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_push_token_id_user_fkey'
    ) THEN
        ALTER TABLE "user_push_token"
            ADD CONSTRAINT "user_push_token_id_user_fkey"
            FOREIGN KEY ("id_user") REFERENCES "user"("id_user")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'daily_digest_queue_id_user_fkey'
    ) THEN
        ALTER TABLE "daily_digest_queue"
            ADD CONSTRAINT "daily_digest_queue_id_user_fkey"
            FOREIGN KEY ("id_user") REFERENCES "user"("id_user")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
