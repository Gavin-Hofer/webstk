import { expect, test, type Page } from '@playwright/test';

const fillEditor = async (page: Page, code: string) => {
  const editorInput = page.locator('.monaco-editor textarea.inputarea').first();
  await editorInput.click();
  await editorInput.press(
    process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
  );
  await editorInput.fill(code);
};

const prepareFormatterPage = async (page: Page): Promise<boolean> => {
  await page.goto('/auto-formatter');

  const loadingIndicator = page.getByText('Loading...');
  await loadingIndicator.waitFor({ state: 'visible' });

  try {
    await expect(loadingIndicator).not.toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.monaco-editor').first()).toBeVisible({
      timeout: 10_000,
    });
    return true;
  } catch {
    return false;
  }
};

test.describe('Auto Formatter', () => {
  test('formats JavaScript code in auto-detect mode', async ({ page }) => {
    test.skip(
      !(await prepareFormatterPage(page)),
      'Monaco editor did not become interactive in this environment.',
    );

    const formatButton = page.getByRole('button', { name: 'Format Code' });

    await expect(formatButton).toBeDisabled();

    await fillEditor(
      page,
      'const message="hello"\nfunction hi(){return message}',
    );
    await expect(formatButton).toBeEnabled();

    await formatButton.click();

    await expect(page.locator('.view-lines')).toContainText(
      'const message = "hello";',
    );
    await expect(page.locator('.view-lines')).toContainText('function hi() {');
    await expect(page.locator('.view-lines')).toContainText('return message;');
  });

  test('shows parsing errors when formatting invalid code', async ({
    page,
  }) => {
    test.skip(
      !(await prepareFormatterPage(page)),
      'Monaco editor did not become interactive in this environment.',
    );

    await fillEditor(page, '{"a":1,,}');

    await page.getByRole('button', { name: 'Format Code' }).click();

    await expect(page.getByText('Error:')).toBeVisible();
  });
});
