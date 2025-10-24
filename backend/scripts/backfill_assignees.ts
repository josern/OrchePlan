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
import { createComponentLogger } from '../src/utils/logger';

const logger = createComponentLogger('BackfillAssignees');

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
      logger.info('Usage: ts-node scripts/backfill_assignees.ts --csv path/to/mapping.csv [--apply] [--verbose]');
      process.exit(0);
    }
  }

  if (!csvPath) {
    logger.error('Error: --csv path required');
    process.exit(2);
  }

  const absPath = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  if (!fs.existsSync(absPath)) {
    logger.error('CSV file not found', { path: absPath });
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

  logger.info(`Read ${rows.length} mappings from ${absPath}`);
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
        logger.warn(`Task not found: ${r.taskId}`);
        continue;
      }

      if (task.assigneeId) {
        skippedHasAssignee++;
        logger.warn(`Task already has assigneeId, skipping: ${r.taskId} -> ${task.assigneeId}`);
        continue;
      }

      const user = await prisma.user.findUnique({ where: { email: r.assigneeEmail } });
      if (!user) {
        skippedNoUser++;
        logger.warn(`No user with email: ${r.assigneeEmail} (task ${r.taskId})`);
        continue;
      }

      if (apply) {
        await prisma.task.update({ where: { id: r.taskId }, data: { assigneeId: user.id } });
        if (verbose) logger.info(`Updated task ${r.taskId} -> assignee ${user.id} (${r.assigneeEmail})`);
      } else {
        if (verbose) logger.info(`[dry-run] Would update task ${r.taskId} -> assignee ${user.id} (${r.assigneeEmail})`);
      }
      updated++;
    } catch (e: any) {
      errors.push({ row: r, error: e.message || String(e) });
    }
  }
  logger.info('--- Summary ---');
  logger.info('Total mappings:', { total: rows.length });
  logger.info('Applied updates (or would apply):', { applied: updated });
  logger.info('Skipped - no task found:', { skippedNoTask });
  logger.info('Skipped - already has assignee:', { skippedHasAssignee });
  logger.info('Skipped - no matching user:', { skippedNoUser });
  if (errors.length > 0) {
    logger.error('Errors during backfill', { count: errors.length, errors: errors.slice(0, 10) });
  }

  // disconnect prisma
  await prisma.$disconnect();
}

main().catch(err => {
  logger.error('Fatal error during backfill', {}, err instanceof Error ? err.message : err);
  process.exit(1);
});
