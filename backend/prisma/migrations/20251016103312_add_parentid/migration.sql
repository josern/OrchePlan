-- Add parentId column to Task and FK to Task(id)

ALTER TABLE "Task" ADD COLUMN "parentId" TEXT;

-- add foreign key constraint referencing Task(id), allow null, set null on delete
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
