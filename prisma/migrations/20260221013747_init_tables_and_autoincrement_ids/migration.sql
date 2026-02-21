-- CreateTable
CREATE TABLE "access" (
    "id_role" INTEGER NOT NULL,
    "id_permission" INTEGER NOT NULL,

    CONSTRAINT "access_pkey" PRIMARY KEY ("id_role","id_permission")
);

-- CreateTable
CREATE TABLE "connection" (
    "id_connection" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "adressee_id" INTEGER NOT NULL,
    "status" VARCHAR,
    "request_at" TIMESTAMPTZ(6),
    "respondend_at" TIMESTAMPTZ(6),

    CONSTRAINT "connection_pkey" PRIMARY KEY ("id_connection")
);

-- CreateTable
CREATE TABLE "course" (
    "id_course" SERIAL NOT NULL,
    "name" VARCHAR,
    "id_program" INTEGER,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id_course")
);

-- CreateTable
CREATE TABLE "enrollment" (
    "id_enrollment" SERIAL NOT NULL,
    "id_user" INTEGER,
    "id_course" INTEGER,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id_enrollment")
);

-- CreateTable
CREATE TABLE "event" (
    "id_event" SERIAL NOT NULL,
    "title" VARCHAR,
    "description" VARCHAR,
    "event_date" TIMESTAMPTZ(6),
    "id_program" INTEGER,
    "image" TEXT,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id_event")
);

-- CreateTable
CREATE TABLE "group" (
    "id_group" SERIAL NOT NULL,
    "name" VARCHAR,
    "description" VARCHAR,
    "id_course" INTEGER,
    "owner_id" INTEGER,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id_group")
);

-- CreateTable
CREATE TABLE "membership" (
    "id_membership" SERIAL NOT NULL,
    "id_user" INTEGER,
    "id_group" INTEGER,
    "is_admin" BOOLEAN,
    "joined_at" TIMESTAMPTZ(6),

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id_membership")
);

-- CreateTable
CREATE TABLE "message" (
    "id_message" SERIAL NOT NULL,
    "id_membership" INTEGER,
    "text_content" VARCHAR,
    "send_at" TIMESTAMPTZ(6),
    "attachments" TEXT,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id_message")
);

-- CreateTable
CREATE TABLE "notification" (
    "id_notification" SERIAL NOT NULL,
    "id_user" INTEGER,
    "message" VARCHAR,
    "is_read" BOOLEAN,
    "created_at" TIMESTAMPTZ(6),
    "related_entity_id" INTEGER,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id_notification")
);

-- CreateTable
CREATE TABLE "permission" (
    "id_permission" SERIAL NOT NULL,
    "name" INTEGER NOT NULL,
    "description" VARCHAR NOT NULL,
    "claim" VARCHAR NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id_permission")
);

-- CreateTable
CREATE TABLE "program" (
    "id_program" SERIAL NOT NULL,
    "name" VARCHAR,

    CONSTRAINT "program_pkey" PRIMARY KEY ("id_program")
);

-- CreateTable
CREATE TABLE "role" (
    "id_role" SERIAL NOT NULL,
    "name" VARCHAR,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id_role")
);

-- CreateTable
CREATE TABLE "user" (
    "id_role" INTEGER NOT NULL,
    "id_user" SERIAL NOT NULL,
    "full_name" VARCHAR NOT NULL,
    "cell_phone" VARCHAR,
    "picture" VARCHAR,
    "email" VARCHAR NOT NULL,
    "id_program" INTEGER,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id_user")
);
