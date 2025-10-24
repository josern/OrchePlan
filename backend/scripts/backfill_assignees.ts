#!/usr/bin/env ts-node
/*
  backfill_assignees.ts

  Usage:
    # dry-run (default) - just report what would be changed
    ts-node scripts/backfill_assignees.ts --csv path/to/mapping.csv

    # apply changes
    ts-node scripts/backfill_assignees.ts --csv path/to/mapping.csv --apply

  CSV format: taskId,assigneeEmail
  - Header row is optional; lines starting with # are ignored

  The script is intentionally conservative: it validates the task and user exist,
  and will only set assigneeId if the task currently has assigneeId = null.
  It logs actions and prints a summary at the end.
*/

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import prisma from '../src/services/sqlClient';

async function main() {
  const args = process.argv.slice(2);
  let csvPath = '';
  let apply = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--csv' && args[i+1]) { csvPath = args[i+1]; i++; }
    if (a === '--apply') apply = true;
  if (a === '--verbose') verbose = true;
    if (a === '--help' || a === '-h') {
      console.log('Usage: ts-node scripts/backfill_assignees.ts --csv path/to/mapping.csv [--apply]');
      process.exit(0);
    }
  }

  if (!csvPath) {
    console.error('Error: --csv path required');
    process.exit(2);
  }

  const absPath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  if (!fs.existsSync(absPath)) {
    console.error('CSV file not found:', absPath);
    process.exit(2);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(absPath), crlfDelay: Infinity });

  const rows: Array<{ taskId: string; assigneeEmail: string }> = [];
  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const cols = line.split(',').map(c => c.trim());
    if (cols.length < 2) continue;
    const [taskId, assigneeEmail] = cols;
    if (!taskId || !assigneeEmail) continue;
    rows.push({ taskId, assigneeEmail });
  }

  console.log(`Read ${rows.length} mappings from ${absPath}`);
  if (rows.length === 0) return process.exit(0);

  let updated = 0;
  let skippedNoTask = 0;
  let skippedHasAssignee = 0;
  let skippedNoUser = 0;
  const errors: Array<{ row: any; error: string }> = [];

  for (const r of rows) {
    try {
      const task = await prisma.task.findUnique({ where: { id: r.taskId } });
      if (!task) {
        skippedNoTask++;
        console.warn(`Task not found: ${r.taskId}`);
        continue;
      }

      if (task.assigneeId) {
        skippedHasAssignee++;
        console.warn(`Task already has assigneeId, skipping: ${r.taskId} -> ${task.assigneeId}`);
        continue;
      }

      const user = await prisma.user.findUnique({ where: { email: r.assigneeEmail } });
      if (!user) {
        skippedNoUser++;
        console.warn(`No user with email: ${r.assigneeEmail} (task ${r.taskId})`);
        continue;
      }

      if (apply) {
        await prisma.task.update({ where: { id: r.taskId }, data: { assigneeId: user.id } });
        if (verbose) console.log(`Updated task ${r.taskId} -> assignee ${user.id} (${r.assigneeEmail})`);
      } else {
        if (verbose) console.log(`[dry-run] Would update task ${r.taskId} -> assignee ${user.id} (${r.assigneeEmail})`);
      }
      updated++;
    } catch (e: any) {
      errors.push({ row: r, error: e.message || String(e) });
    }
  }

  console.log('--- Summary ---');
  console.log('Total mappings:', rows.length);
  console.log('Applied updates (or would apply):', updated);
  console.log('Skipped - no task found:', skippedNoTask);
  console.log('Skipped - already has assignee:', skippedHasAssignee);
  console.log('Skipped - no matching user:', skippedNoUser);
  if (errors.length > 0) {
    console.error('Errors:', errors.length);
    for (const err of errors.slice(0,10)) {
      console.error(err);
    }
  }

  // disconnect prisma
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error during backfill:', err);
  process.exit(1);
});
