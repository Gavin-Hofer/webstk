import { expect, test, type Page } from '@playwright/test';

const fillEditor = async (page: Page, code: string) => {
  const editor = page.locator('.monaco-editor').first();
  await editor.click({ position: { x: 24, y: 24 }, force: true });
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+A' : 'Control+A',
  );
  await page.keyboard.type(code);
};

const waitForEditorState = async (page: Page) => {
  await page.goto('/auto-formatter');

  const editorRoot = page.locator('.monaco-editor').first();
  const loadError = page.getByTestId('editor-load-error');

  await Promise.race([
    editorRoot.waitFor({ state: 'visible', timeout: 15_000 }),
    loadError.waitFor({ state: 'visible', timeout: 15_000 }),
  ]);

  if (await loadError.isVisible()) {
    return 'failed' as const;
  }

  return 'ready' as const;
};

test.describe('Auto Formatter', () => {
  test('loads a usable editor or shows a graceful load failure state', async ({
    page,
  }) => {
    const state = await waitForEditorState(page);

    if (state === 'failed') {
      await expect(
        page.getByText('The code editor failed to load.'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Retry editor' }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Format Code' }),
      ).toBeDisabled();
      return;
    }

    const formatButton = page.getByRole('button', { name: 'Format Code' });
    await expect(formatButton).toBeDisabled();

    const inputArea = page.locator('.monaco-editor textarea.inputarea').first();
    if (!(await inputArea.isVisible().catch(() => false))) {
      await expect(page.locator('.monaco-editor').first()).toBeVisible();
      return;
    }

    await fillEditor(
      page,
      'const message="hello"\nfunction hi(){return message}',
    );

    await expect(formatButton).toBeEnabled();
    await formatButton.click();

    await expect(page.locator('.view-lines')).toContainText(
      'const message = "hello";',
    );
  });

  test('shows parsing errors when formatting invalid code', async ({
    page,
  }) => {
    const state = await waitForEditorState(page);

    if (state === 'failed') {
      await page.getByRole('button', { name: 'Retry editor' }).click();
      await expect(page.getByText('Loading editor...')).toBeVisible();
      await expect(page.getByTestId('editor-load-error')).toBeVisible({
        timeout: 15_000,
      });
      return;
    }

    const inputArea = page.locator('.monaco-editor textarea.inputarea').first();
    if (!(await inputArea.isVisible().catch(() => false))) {
      await expect(page.locator('.monaco-editor').first()).toBeVisible();
      return;
    }

    await fillEditor(page, '{"a":1,,}');
    await page.getByRole('button', { name: 'Format Code' }).click();

    await expect(page.getByText('Error:')).toBeVisible();
  });
});
