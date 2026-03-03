import { expect, test } from '@playwright/test';

test.describe('QR Code Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qr-code-generator');
  });

  test('validates input and generates a QR code for valid URLs', async ({
    page,
  }) => {
    const urlInput = page.getByLabel('URL');
    const generateButton = page.getByRole('button', {
      name: 'Generate QR Code',
    });
    const resetButton = page.getByRole('button', { name: 'Reset' });
    const generatedQrCode = page.locator('section svg[role="img"]');

    await expect(
      page.getByText('Enter a valid URL, then click generate.'),
    ).toBeVisible();
    await expect(generateButton).toBeDisabled();
    await expect(resetButton).toBeDisabled();

    await urlInput.fill('example.com');
    await expect(generateButton).toBeDisabled();

    await urlInput.fill('   https://webstk.com/tools   ');
    await expect(generateButton).toBeEnabled();

    await generateButton.click();

    await expect(generatedQrCode).toBeVisible();
    await expect(page).toHaveURL(/url=https:\/\/webstk\.com\/tools/);
    await expect(resetButton).toBeEnabled();
  });

  test('reset clears both the generated qr code and query state', async ({
    page,
  }) => {
    const urlInput = page.getByLabel('URL');
    const generateButton = page.getByRole('button', {
      name: 'Generate QR Code',
    });
    const resetButton = page.getByRole('button', { name: 'Reset' });
    const generatedQrCode = page.locator('section svg[role="img"]');

    await urlInput.fill('https://example.org/path');
    await generateButton.click();
    await expect(generatedQrCode).toBeVisible();

    await resetButton.click();

    await expect(urlInput).toHaveValue('');
    await expect(
      page.getByText('Enter a valid URL, then click generate.'),
    ).toBeVisible();
    await expect(generatedQrCode).toHaveCount(0);
    await expect(page).toHaveURL('/qr-code-generator');
    await expect(generateButton).toBeDisabled();
    await expect(resetButton).toBeDisabled();
  });
});
