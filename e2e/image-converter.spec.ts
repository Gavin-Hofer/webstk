import path from 'node:path';

import { expect, test } from '@playwright/test';

const FIXTURE_IMAGE = path.join(
  import.meta.dirname,
  'fixtures',
  'test-image.png',
);

// Each test gets a fresh browser context (fresh IndexedDB) by default.
test.describe('Image Converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/image-converter');
  });

  test('loads the page with empty state', async ({ page }) => {
    await expect(page.getByText('No images yet')).toBeVisible();
  });

  test('accepts an uploaded image and shows it in the list', async ({
    page,
  }) => {
    await page.getByTestId('file-input').setInputFiles(FIXTURE_IMAGE);
    await expect(page.getByTestId('image-card')).toBeVisible();
  });

  test('converts to PNG by default and shows file size', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles(FIXTURE_IMAGE);
    await expect(page.getByTestId('file-size')).toBeVisible({
      timeout: 60_000,
    });
  });

  test('changing format to JPEG triggers reconversion', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles(FIXTURE_IMAGE);
    await expect(page.getByTestId('image-card')).toBeVisible();

    await page.getByTestId('format-select').click();
    await page.getByRole('option', { name: 'JPEG' }).click();

    await expect(page.getByTestId('file-size')).toBeVisible({
      timeout: 60_000,
    });
  });

  test('changing format to PNG triggers reconversion', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles(FIXTURE_IMAGE);
    await expect(page.getByTestId('image-card')).toBeVisible();

    // Switch to JPEG first, then back to PNG to trigger reconversion
    await page.getByTestId('format-select').click();
    await page.getByRole('option', { name: 'JPEG' }).click();
    await expect(page.getByTestId('file-size')).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId('format-select').click();
    await page.getByRole('option', { name: 'PNG' }).click();
    await expect(page.getByTestId('file-size')).toBeVisible({
      timeout: 60_000,
    });
  });

  test('changing format to AVIF triggers reconversion', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles(FIXTURE_IMAGE);
    await expect(page.getByTestId('image-card')).toBeVisible();

    await page.getByTestId('format-select').click();
    await page.getByRole('option', { name: 'AVIF' }).click();

    await expect(page.getByTestId('file-size')).toBeVisible({
      timeout: 60_000,
    });
  });

  test('download button downloads a file with the correct MIME type', async ({
    page,
  }) => {
    await page.getByTestId('file-input').setInputFiles(FIXTURE_IMAGE);
    await expect(page.getByTestId('file-size')).toBeVisible({
      timeout: 60_000,
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-button').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.png$/i);
  });

  test('"Download All" button downloads the converted file', async ({
    page,
  }) => {
    await page.getByTestId('file-input').setInputFiles(FIXTURE_IMAGE);
    await expect(page.getByTestId('file-size')).toBeVisible({
      timeout: 60_000,
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-all-button').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(
      /\.(png|jpeg|webp|gif|bmp|tiff|avif)$/i,
    );
  });
});
