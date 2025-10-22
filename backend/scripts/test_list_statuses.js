const { listStatusesByProject } = require('../src/services/sqlClient');
(async () => {
  try {
    const rows = await listStatusesByProject(process.env.TEST_PROJECT_ID || '');
    console.log('rows', JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('listStatusesByProject failed', e);
  } finally {
    process.exit(0);
  }
})();
