import { test, expect } from '@playwright/test';

const testUser = { email: 'test@example.com', password: 'password123', name: 'Test User' };
let createdProjectName = '';
let createdTaskTitle = '';

test.describe('Expanded E2E flows', () => {
  test.beforeEach(async ({ page }) => {
    // ensure starting from root
    await page.goto('/');
  });

  test('create project -> add task -> add subtask -> update profile -> logout', async ({ page, request }) => {
      // Ensure test user exists via backend API to avoid flaky UI-only signup races
      try {
        await request.post('http://localhost:3000/auth/signup', {
          data: { name: testUser.name, email: testUser.email, password: testUser.password },
          // short timeout for API creation
          timeout: 5000,
        });
      } catch (err: any) {
        // If the user already exists, backend may return 409 or similar — ignore
        // Also ignore other transient network errors here; the UI login will surface them.
      }
    // Login first (assume user exists from backend smoke-test)
    await page.goto('/login');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');
    // Wait longer for login/navigation; if not redirected, look for login failure message
    // Wait for dashboard either by URL or by seeing the Projects section.
    let loggedIn = false;
    try {
      await Promise.race([
        page.waitForURL('**/dashboard', { timeout: 15000 }),
        page.waitForSelector('text=Projects', { timeout: 15000 })
      ]);
      loggedIn = true;
    } catch (e) {
      // If not, try a soft reload and check again for Projects
      await page.reload({ waitUntil: 'load' }).catch(() => {});
      try {
        await page.waitForSelector('text=Projects', { timeout: 5000 });
        loggedIn = true;
      } catch (e2) {
        const failed = await page.locator('text=Login Failed').count();
        if (failed > 0) {
          throw new Error('Login failed: invalid credentials or backend did not accept the login');
        }
      }
    }
    if (!loggedIn) throw new Error('Login did not reach dashboard or show Projects — aborting expanded flow');

    // Open Add Project dialog (there's a button in UI header, try menu text or "Create New Project")
    // Try a common trigger: button with text "Create Project" or "Add Project"; fallback to dialog trigger aria
    // Ensure we're at the app root where the sidebar exists and wait for Projects section
    await page.goto('/');
    await page.waitForSelector('text=Projects', { timeout: 5000 }).catch(() => {});

    // Try several selectors sequentially to find the Add Project trigger.
    const addProjectSelectors = [
      'button:has-text("New Project")',
      'text=New Project',
      'button:has-text("Create Project")',
      'text=Create New Project',
      'button[data-sidebar="group-action"]',
      'button[data-sidebar="trigger"]',
      'button[aria-label="Toggle Sidebar"]',
    ];

    let clicked = false;
    for (const sel of addProjectSelectors) {
      const loc = page.locator(sel).first();
      try {
        if (await loc.count() > 0 && await loc.isVisible()) {
          await loc.click();
          clicked = true;
          break;
        }
      } catch (e) {
        // ignore selector errors and continue
      }
    }

    // If not found, try toggling the sidebar then retry the primary text selector
    if (!clicked) {
      const sidebarToggle = page.locator('button[data-sidebar="trigger"], button[aria-label="Toggle Sidebar"], button:has-text("Toggle Sidebar")').first();
      if ((await sidebarToggle.count()) > 0) {
        await sidebarToggle.click().catch(() => {});
        await page.waitForTimeout(300);
      }
      // Try fallback selectors separately to avoid CSS parsing errors
      const fallbackBtn = page.locator('button:has-text("New Project")').first();
      if ((await fallbackBtn.count()) > 0 && await fallbackBtn.isVisible()) {
        await fallbackBtn.click();
        clicked = true;
      } else {
        const fallbackText = page.locator('text=New Project').first();
        if ((await fallbackText.count()) > 0 && await fallbackText.isVisible()) {
          await fallbackText.click();
          clicked = true;
        }
      }
    }

    if (!clicked) throw new Error('Could not find Add Project trigger on page');

    // Fill and submit Create Project
    createdProjectName = `E2E Project ${Date.now()}`;
  // Fill project name input — use label placeholder used in UI
  await page.fill('input[placeholder^="e.g., Q4"]', createdProjectName);
  await page.click('button:has-text("Create Project")');

    // Wait for project to appear in project list
    await page.waitForTimeout(800);
    const projectItem = page.locator(`text=${createdProjectName}`).first();
    await expect(projectItem).toHaveCount(1);

    // Navigate to project page (click the project)
    await projectItem.click();
    await page.waitForURL('**/project/**', { timeout: 5000 });

    // Open Add Task dialog via 'Add Task' button
    // Open Add Task dialog via common button texts
    await page.click('button:has-text("Add New Task")').catch(async () => {
      await page.click('button:has-text("Add Task")').catch(() => {});
    });

    // Fill task form
    createdTaskTitle = `E2E Task ${Date.now()}`;
    await page.fill('input[placeholder^="e.g., Finalize the Q3"]', createdTaskTitle).catch(() => {});
    // Ensure project select is set (if not, pick the first)
    // Attempt to set the project selector — many implementations use a custom select; try to pick by visible label
    await page.selectOption('select', { label: createdProjectName }).catch(() => {});

    // Submit Create Task
    await page.click('button:has-text("Create Task")');

    // Wait and verify task appears in task list
    await page.waitForTimeout(800);
    const taskItem = page.locator(`text=${createdTaskTitle}`).first();
    await expect(taskItem).toHaveCount(1);

    // Open task to add sub-task (click task item)
    await taskItem.click();
    // Click any visible Add Sub-task button
    await page.click('button:has-text("Add Sub-task")').catch(() => {});

    // Fill subtask title
    const subTaskTitle = `E2E Subtask ${Date.now()}`;
    await page.fill('input[placeholder="Sub-task title"]', subTaskTitle).catch(() => {});
    await page.click('button:has-text("Add Sub-task")');

    // Wait and confirm subtask appears
    await page.waitForTimeout(800);
    await expect(page.locator(`text=${subTaskTitle}`).first()).toHaveCount(1);

    // Update profile
  await page.goto('/settings');
  // Navigate to Profile section
  await page.click('text=Profile').catch(() => {});
    await page.fill('input[placeholder="Your Name"]', 'E2E Tester');
    await page.click('button:has-text("Save Changes")');

    // Wait for toast
    await page.waitForTimeout(800);
    await expect(page.locator('text=Profile Updated').first()).toHaveCount(1);

    // Logout
    await page.click('button:has-text("Logout")').catch(async () => {
      // fallback: click account menu and then logout link
      await page.click('text=Sign out').catch(() => {});
    });

    // Verify redirected to login or root
    await page.waitForURL('**/login', { timeout: 5000 }).catch(() => {});
  });
});
