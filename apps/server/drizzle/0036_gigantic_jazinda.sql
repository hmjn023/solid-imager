CREATE TABLE "media_group_members" (
	"group_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer,
	"state" text NOT NULL,
	"origin" text NOT NULL,
	CONSTRAINT "media_group_members_group_id_media_id_pk" PRIMARY KEY("group_id","media_id"),
	CONSTRAINT "media_group_position" CHECK ("media_group_members"."position" is null or "media_group_members"."position" >= 0),
	CONSTRAINT "media_group_state" CHECK ("media_group_members"."state" in ('candidate', 'tentative', 'confirmed', 'rejected')),
	CONSTRAINT "media_group_origin" CHECK ("media_group_members"."origin" in ('manual', 'source'))
);
--> statement-breakpoint
CREATE TABLE "media_groups" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"source_key" text,
	CONSTRAINT "media_groups_source_key_unique" UNIQUE("source_key"),
	CONSTRAINT "media_group_kind" CHECK ("media_groups"."kind" in ('post', 'comic', 'variant'))
);
--> statement-breakpoint
ALTER TABLE "media_group_members" ADD CONSTRAINT "media_group_members_group_id_media_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_group_members" ADD CONSTRAINT "media_group_members_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_group_member_media" ON "media_group_members" USING btree ("media_id");