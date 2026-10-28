import { test, expect } from '@playwright/test';

test.describe('BLUETTI 200 V2 purchase flow', () => {
  test('searches, selects the cheapest available matching product, and adds it to the cart', async ({ page }) => {
    await test.step('Search for BLUETTI 200 V2', async () => {
      await page.goto('https://www.itbox.ua/');
      const search = page.getByRole('textbox', { name: 'Пошук' });
      await search.fill('BLUETTI 200 V2');
      await search.press('Enter');
      await expect(page).toHaveURL(/\/ua\/search\/\?Search=BLUETTI%20200%20V2/);
    });

    const matchingAvailableProducts = page.locator('.product-card:not(.out-of-stock)').filter({ hasText: /BLUETTI.*200 V2/i });
    await expect(matchingAvailableProducts.first()).toBeVisible();

    const offers = await matchingAvailableProducts.evaluateAll(cards => cards.map(card => {
      const text = card.textContent ?? '';
      const priceMatches = [...text.matchAll(/([\d\s]+)\s*грн/g)].map(match => Number(match[1].replace(/\s/g, '')));
      const link = card.querySelector<HTMLAnchorElement>('a.to_product');
      return { card, price: Math.min(...priceMatches.filter(Number.isFinite)), href: link?.href };
    }).filter(offer => offer.href && Number.isFinite(offer.price)));
    expect(offers.length).toBeGreaterThan(0);
    const cheapest = offers.reduce((current, offer) => offer.price < current.price ? offer : current);
    await page.goto(cheapest.href!);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/BLUETTI.*200 V2/i);
    await expect(page.locator('body')).toContainText(/в наявності/i);
    await expect(page.locator('body')).toContainText(new RegExp(`${cheapest.price.toLocaleString('uk-UA').replace(/\s/g, '[\\s\\u00a0]?')}\\s*грн`));

    const buyButton = page.locator('a.add-cart').first();
    await expect(buyButton).toBeVisible();
    await expect(buyButton).toBeEnabled();
    await buyButton.click();
    await expect(page.getByRole('heading', { name: 'Товар доданий в кошик' })).toBeVisible();
  });
});
