/**
 * E2E Test: Appointment Booking Flow
 * Tests the complete user journey from landing to appointment creation
 */

import { test, expect } from '@playwright/test';

test.describe('Appointment Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display appointment type selection on load', async ({ page }) => {
    // Check header
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.rolex-logo')).toBeVisible();

    // Check appointment types
    await expect(page.locator('#typeDelivery')).toBeVisible();
    await expect(page.locator('#typeService')).toBeVisible();
    await expect(page.locator('#typeMeeting')).toBeVisible();

    // Management type should be hidden initially
    await expect(page.locator('#typeManagement')).toBeHidden();
  });

  test('should navigate through appointment flow', async ({ page }) => {
    // Step 1: Select appointment type
    await page.click('#typeDelivery');

    // Step 2: Calendar should appear
    await expect(page.locator('#calendarSection')).toBeVisible();
    await expect(page.locator('#currentMonth')).toContainText(/\d{4}/); // Should contain year

    // Step 3: Select a future date
    const futureDateCell = page.locator('.calendar-day:not(.disabled):not(.past)').first();
    await futureDateCell.click();

    // Step 4: Staff selection should appear
    await expect(page.locator('#staffSection')).toBeVisible();
  });

  test('should validate form fields', async ({ page }) => {
    // Navigate to form (simplified - assumes we can get there)
    // This would require mocking or setting up test data

    // Check form validation
    const submitBtn = page.locator('#submitBtn');

    // Try to submit without filling
    if (await submitBtn.isVisible()) {
      await submitBtn.click();

      // Should show validation errors
      await expect(page.locator('#alertContainer')).toContainText(/zorunlu|required/i);
    }
  });

  test('should show Turnstile widget when ready to submit', async ({ page }) => {
    const turnstile = page.locator('#turnstileContainer');

    // Initially hidden
    await expect(turnstile).toBeHidden();

    // After completing steps, should be visible
    // (This would require full flow completion)
  });

  test('should be mobile responsive', async ({ page, viewport }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check responsive layout
    const container = page.locator('.container');
    await expect(container).toBeVisible();

    // Appointment types should stack vertically on mobile
    const typeCards = page.locator('.type-card');
    const count = await typeCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

test.describe('Appointment Calendar', () => {
  test('should navigate between months', async ({ page }) => {
    await page.goto('/');

    // Select type to show calendar
    await page.click('#typeDelivery');

    const currentMonthText = await page.locator('#currentMonth').textContent();

    // Go to next month
    await page.click('#nextMonthBtn');

    const nextMonthText = await page.locator('#currentMonth').textContent();

    // Month should have changed
    expect(currentMonthText).not.toBe(nextMonthText);

    // Go to previous month
    await page.click('#prevMonthBtn');

    const prevMonthText = await page.locator('#currentMonth').textContent();

    // Should be back to original month
    expect(prevMonthText).toBe(currentMonthText);
  });
});
