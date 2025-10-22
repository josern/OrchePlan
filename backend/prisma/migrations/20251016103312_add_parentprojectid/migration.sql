-- Add parentProjectId column to Project and FK to Project(id)

ALTER TABLE "Project" ADD COLUMN "parentProjectId" TEXT;

ALTER TABLE "Project" ADD CONSTRAINT "Project_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
