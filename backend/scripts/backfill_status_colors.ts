import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function pickColorForLabel(label?: string | null) {
  if (!label) return '#9CA3AF';
  const l = label.toLowerCase().trim();
  if (l === 'to-do' || l === 'todo' || l === 'to do') return '#3B82F6';
  if (l.includes('in progress') || l.includes('in-progress')) return '#EAB308';
  if (l === 'done' || l.includes('done')) return '#22C55E';
  if (l === 'remove' || l.includes('remove') || l.includes('archiv') || l.includes('delete')) return '#EF4444';
  return '#9CA3AF';
}

async function main() {
  console.log('Backfill: looking for TaskStatus rows with null color...');
  const rows = await prisma.taskStatus.findMany({ where: { color: null } });
  console.log(`Found ${rows.length} rows with null color.`);
  if (rows.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const r of rows) {
    const color = pickColorForLabel(r.label);
    try {
      await prisma.taskStatus.update({ where: { id: r.id }, data: { color } });
      console.log(`Updated status ${r.id} (${r.label}) -> ${color}`);
      updated++;
    } catch (e) {
      console.error('Failed to update status', r.id, e);
    }
  }

  console.log(`Backfill complete. Updated ${updated} / ${rows.length} rows.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Backfill script error', e);
  try {
    await prisma.$disconnect();
  } catch { }
  process.exit(1);
});
