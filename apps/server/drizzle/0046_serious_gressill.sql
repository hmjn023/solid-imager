CREATE TABLE "job_history_dismissals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL
);
