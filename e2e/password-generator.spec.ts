import { expect, test } from '@playwright/test';

test.describe('Password Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/password-generator');
  });

  test('generates passwords with configured length and character options', async ({
    page,
  }) => {
    const passwordInput = page.getByPlaceholder(
      'Click generate to create a password',
    );

    await expect(passwordInput).toHaveValue('');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.getByLabel('Password Length').fill('32');
    await page.getByRole('button', { name: 'Generate Password' }).click();

    await expect(passwordInput).not.toHaveValue('');
    const generatedPassword = await passwordInput.inputValue();
    expect(generatedPassword).toHaveLength(32);

    await page.getByLabel('Symbols').click();
    await page.getByRole('button', { name: 'Generate Password' }).click();

    const passwordWithoutSymbols = await passwordInput.inputValue();
    expect(passwordWithoutSymbols).toMatch(/^[A-Za-z0-9]+$/);

    await page.getByLabel('No ambiguous characters').click();
    await page.getByRole('button', { name: 'Generate Password' }).click();

    const passwordWithoutAmbiguousChars = await passwordInput.inputValue();
    expect(passwordWithoutAmbiguousChars).not.toMatch(/[0Oo1lI|B82ZS5]/);
  });

  test('show/hide and copy controls behave correctly', async ({ page }) => {
    const passwordInput = page.getByPlaceholder(
      'Click generate to create a password',
    );
    const generateButton = page.getByRole('button', {
      name: 'Generate Password',
    });

    await expect(
      page.getByRole('button', { name: 'Copy password' }),
    ).toBeDisabled();
    await expect(passwordInput).toHaveValue('');

    await generateButton.click();
    await expect(passwordInput).not.toHaveValue('');

    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await page.getByLabel('Lowercase').click();
    await page.getByLabel('Uppercase').click();
    await page.getByLabel('Numbers').click();
    await page.getByLabel('Symbols').click();

    await expect(generateButton).toBeDisabled();
  });
});
