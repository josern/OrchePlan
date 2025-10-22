import { test, expect } from '@playwright/test';

test('toggles compact mode via settings', async ({ page }) => {
  await page.goto('/');
  // ensure logged in — this repo has dev auth flows; if not authenticated, we skip
  // attempt: navigate to settings
  await page.goto('/settings');
  // click the Comfortable/Compact tab
  const compactTab = page.getByRole('tab', { name: 'Compact' });
  await compactTab.click();
  // assert body has class compact
  await expect(page.locator('body')).toHaveClass(/compact/);
});
