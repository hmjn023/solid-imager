ALTER TABLE "authors" ADD CONSTRAINT "authors_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_name_unique" UNIQUE("name");