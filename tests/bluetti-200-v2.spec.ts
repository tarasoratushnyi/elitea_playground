import { test, expect } from '@playwright/test';

const searchTerm = 'BLUETTI 200 V2';
const productLink = 'a[href*="/ua/product/"]';

function priceFromText(text: string): number | undefined {
  const prices = [...text.matchAll(/([\d\s\u00a0]+)\s*грн/g)]
    .map(match => Number(match[1].replace(/[\s\u00a0]/g, '')))
    .filter(Number.isFinite);
  return prices.length ? Math.min(...prices) : undefined;
}

test.describe('ITbox BLUETTI 200 V2 purchase flow', () => {
  test('selects the cheapest available matching offer and adds it to the cart', async ({ page }) => {
    await test.step('Arrange: open ITbox and search for the requested model', async () => {
      await page.goto('https://www.itbox.ua/');
      const search = page.getByRole('textbox', { name: 'Пошук' });
      await search.fill(searchTerm);
      await expect(page.getByRole('link', { name: /Всі результати/ })).toBeVisible();
      await page.getByRole('link', { name: /Всі результати/ }).click();
      await expect(page).toHaveURL(/\/ua\/search\/\?Search=BLUETTI%20200%20V2/);
    });

    await test.step('Act: compare matching available offers and open the cheapest one', async () => {
      const candidateLinks = page.locator(productLink).filter({ hasText: /BLUETTI.*200 V2/i });
      await expect(candidateLinks.first()).toBeVisible();

      const offers = await candidateLinks.evaluateAll(links => links.map(link => {
        const cardText = link.parentElement?.parentElement?.innerText ?? link.innerText;
        const available = /в наявності/i.test(cardText);
        const price = priceFromText(cardText);
        return { href: (link as HTMLAnchorElement).href, name: link.textContent?.trim() ?? '', available, price };
      }).filter(offer => offer.available && offer.price !== undefined));

      expect(offers.length, 'At least one matching offer must be available').toBeGreaterThan(0);
      const cheapest = offers.reduce((current, offer) => offer.price! < current.price! ? offer : current);
      await page.goto(cheapest.href);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(cheapest.name);
      await expect(page.locator('body')).toContainText(/в наявності/i);

      const displayedPrice = page.locator('a.add-cart[data-price]').first();
      await expect(displayedPrice).toHaveAttribute('data-price', String(cheapest.price));
    });

    await test.step('Assert: verify and use the purchase button without checking out', async () => {
      const buyButton = page.locator('a.add-cart[data-id]').first();
      await expect(buyButton, 'Buy button is visible').toBeVisible();
      await expect(buyButton, 'Buy button is enabled').toBeEnabled();
      await buyButton.click();
      await expect(page).toHaveURL(/\/ua\/order\//);
      await expect(page.locator('body')).toContainText(/BLUETTI.*200 V2/i);
    });
  });
});
