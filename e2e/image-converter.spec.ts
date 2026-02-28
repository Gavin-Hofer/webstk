import { expect, test } from '@playwright/test';

import { testImage } from './data/images';

const allTestImages = [
  testImage.avif,
  testImage.bmp,
  testImage.gif,
  testImage.jpeg,
  testImage.png,
  testImage.tiff,
  testImage.webp,
];

// Each test gets a fresh browser context (fresh IndexedDB) by default.
test.describe('Image Converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/image-converter');
  });

  test('loads the page with empty state', async ({ page }) => {
    await expect(page.getByText('No images yet')).toBeVisible();
  });

  test('accepts uploaded images of different formats and renders previews', async ({
    page,
  }) => {
    for (const imagePath of allTestImages) {
      await page.getByTestId('file-input').setInputFiles(imagePath);

      const card = page.getByTestId('image-card').last();
      await expect(card).toBeVisible();
      await expect(card.getByTestId('file-size')).toBeVisible({
        timeout: 60_000,
      });
    }

    await expect(page.getByTestId('image-card')).toHaveCount(
      allTestImages.length,
    );

    const pngCard = page
      .getByTestId('image-card')
      .filter({ has: page.getByText('test-image.png') })
      .first();
    await expect(pngCard.getByTestId('image-preview-thumbnail')).toBeVisible();
  });

  test('accepts multiple uploaded files with mixed formats in one selection', async ({
    page,
  }) => {
    await page
      .getByTestId('file-input')
      .setInputFiles([testImage.png, testImage.webp, testImage.jpeg]);

    await expect(page.getByTestId('image-card')).toHaveCount(3);
    await expect(page.getByTestId('file-size')).toHaveCount(3, {
      timeout: 60_000,
    });

    const imageCards = page.getByTestId('image-card');
    await expect(
      imageCards.nth(0).getByTestId('image-preview-thumbnail'),
    ).toBeVisible();
    await expect(
      imageCards.nth(1).getByTestId('image-preview-thumbnail'),
    ).toBeVisible();
    await expect(
      imageCards.nth(2).getByTestId('image-preview-thumbnail'),
    ).toBeVisible();
  });

  test('download all can download multiple converted files with the same format', async ({
    page,
  }) => {
    await page
      .getByTestId('file-input')
      .setInputFiles([testImage.png, testImage.jpeg, testImage.webp]);

    await expect(page.getByTestId('file-size')).toHaveCount(3, {
      timeout: 60_000,
    });

    for (let index = 0; index < 3; index += 1) {
      await page
        .getByTestId('image-card')
        .nth(index)
        .getByTestId('format-select')
        .click();
      await page.getByRole('option', { name: 'PNG' }).click();
    }

    const downloadsPromise = Promise.all([
      page.waitForEvent('download'),
      page.waitForEvent('download'),
      page.waitForEvent('download'),
    ]);

    await page.getByTestId('download-all-button').click();

    const downloads = await downloadsPromise;
    expect(downloads).toHaveLength(3);
    for (const download of downloads) {
      expect(download.suggestedFilename()).toMatch(/\.png$/i);
    }
  });

  test('download all can download multiple files with mixed current formats', async ({
    page,
  }) => {
    await page
      .getByTestId('file-input')
      .setInputFiles([testImage.png, testImage.jpeg, testImage.webp]);

    await expect(page.getByTestId('file-size')).toHaveCount(3, {
      timeout: 60_000,
    });

    await page
      .getByTestId('image-card')
      .nth(0)
      .getByTestId('format-select')
      .click();
    await page.getByRole('option', { name: 'PNG' }).click();

    await page
      .getByTestId('image-card')
      .nth(1)
      .getByTestId('format-select')
      .click();
    await page.getByRole('option', { name: 'GIF' }).click();

    await page
      .getByTestId('image-card')
      .nth(2)
      .getByTestId('format-select')
      .click();
    await page.getByRole('option', { name: 'BMP' }).click();

    await expect(page.getByTestId('download-all-format-select')).toContainText(
      'Mixed',
    );

    const downloadsPromise = Promise.all([
      page.waitForEvent('download'),
      page.waitForEvent('download'),
      page.waitForEvent('download'),
    ]);

    await page.getByTestId('download-all-button').click();

    const downloads = await downloadsPromise;

    expect(downloads).toHaveLength(3);
    for (const download of downloads) {
      expect(download.suggestedFilename()).toMatch(
        /\.(png|jpe?g|webp|gif|bmp|tiff|avif)$/i,
      );
    }
  });

  test('image preview dialog supports interactions', async ({ page }) => {
    await page.getByTestId('file-input').setInputFiles(testImage.png);
    await expect(page.getByTestId('file-size')).toBeVisible({
      timeout: 60_000,
    });

    const previewTrigger = page
      .getByTestId('image-card')
      .first()
      .getByTestId('image-preview-trigger');
    await previewTrigger.click();

    await expect(page.getByTestId('image-viewer-dialog')).toBeVisible();
    await expect(page.getByTestId('image-viewer-image')).toBeVisible();
    await expect(page.getByTestId('image-viewer-zoom-percent')).toHaveText(
      '100%',
    );

    await page.getByTestId('image-viewer-zoom-in').click();
    await expect(page.getByTestId('image-viewer-zoom-percent')).toHaveText(
      '125%',
    );

    await page.getByTestId('image-viewer-toggle-fullscreen').click();
    await expect(page.getByTestId('image-viewer-dialog')).toBeVisible();

    await page.getByTestId('image-viewer-reset-view').click();
    await expect(page.getByTestId('image-viewer-zoom-percent')).toHaveText(
      '100%',
    );

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('image-viewer-dialog')).not.toBeVisible();
  });
});
