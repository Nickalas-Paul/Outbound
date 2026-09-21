const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '.integration-shots');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: false,
  });
}

async function checkOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowX: doc.scrollWidth > doc.clientWidth + 2,
      bodyOverflow: document.body.scrollWidth > document.body.clientWidth + 2,
    };
  });
}

async function countVisible(page, selector) {
  return page.locator(selector).evaluateAll((els) =>
    els.filter((el) => {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        s.display !== 'none' &&
        s.visibility !== 'hidden' &&
        r.width > 0 &&
        r.height > 0
      );
    }).length
  );
}

async function layoutProbe(page) {
  return page.evaluate(() => {
    const w = window.innerWidth;
    const sidebar = Array.from(document.querySelectorAll('*')).find((el) => {
      const t = (el.textContent || '').trim();
      return (
        t.startsWith('Outbound') &&
        t.includes('Explorer') &&
        t.includes('About') &&
        el.getBoundingClientRect().width > 150 &&
        el.getBoundingClientRect().width < 280
      );
    });
    const tabLabels = Array.from(document.querySelectorAll('[role="tab"], a, button, div'))
      .filter((el) => {
        const t = (el.textContent || '').trim();
        return t === 'Explorer' || t === 'About' || t === 'Plan a Trip';
      })
      .map((el) => ({
        text: (el.textContent || '').trim(),
        bottom: el.getBoundingClientRect().bottom,
        top: el.getBoundingClientRect().top,
      }));
    const fab = Array.from(document.querySelectorAll('*')).find((el) =>
      /^Filters$/i.test((el.textContent || '').trim())
    );
    const legend = Array.from(document.querySelectorAll('*')).find((el) =>
      /Low|High|TVI/i.test((el.textContent || '').slice(0, 40))
    );
    const compare = Array.from(document.querySelectorAll('*')).find((el) =>
      /Comparing:/i.test((el.textContent || '').slice(0, 80))
    );
    const box = (el) =>
      el
        ? {
            text: (el.textContent || '').trim().slice(0, 60),
            top: Math.round(el.getBoundingClientRect().top),
            bottom: Math.round(el.getBoundingClientRect().bottom),
            left: Math.round(el.getBoundingClientRect().left),
            right: Math.round(el.getBoundingClientRect().right),
          }
        : null;
    return {
      width: w,
      hasSidebar: Boolean(sidebar),
      fab: box(fab),
      legend: box(legend),
      compare: box(compare),
      tabSample: tabLabels.slice(0, 8),
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  async function runViewport(width, height, label) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(String(err));
    });

    // Fresh visit — welcome overlay
    async function goto(url) {
      await page.goto(url.replace('localhost', '127.0.0.1'), {
        waitUntil: 'commit',
        timeout: 120000,
      });
      await page.waitForTimeout(2500);
    }

    await goto('http://localhost:8081/');
    await page.evaluate(() => localStorage.removeItem('outbound_welcome_seen'));
    await page.reload({ waitUntil: 'commit', timeout: 120000 });
    await page.waitForTimeout(3500);
    await shot(page, `${label}-welcome`);
    const welcomeCta = page.getByRole('button', { name: /Start Exploring/i });
    const welcomeVisible = (await welcomeCta.count()) > 0;
    results.push({
      label,
      route: '/',
      stage: 'welcome',
      welcomeVisible,
      overflow: await checkOverflow(page),
    });

    if (welcomeVisible) {
      await welcomeCta.click();
      await page.waitForTimeout(1200);
    }
    await shot(page, `${label}-explorer`);
    const probe = await layoutProbe(page);
    results.push({
      label,
      route: '/',
      stage: 'explorer',
      overflow: await checkOverflow(page),
      layout: probe,
      sidebarExpected: width >= 768,
      sidebarOk: width >= 768 ? probe.hasSidebar : !probe.hasSidebar,
    });

    // Filters FAB (mobile only)
    if (width < 768) {
      const filtersBtn = page.getByText(/^Filters$/i).first();
      if (await filtersBtn.count()) {
        await filtersBtn.click();
        await page.waitForTimeout(800);
        await shot(page, `${label}-filters-sheet`);
        results.push({
          label,
          stage: 'filters-sheet',
          overflow: await checkOverflow(page),
        });
        // Close sheet — press Escape or click backdrop
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // Compare with 2 countries via URL then back to explorer selection
    await goto('http://localhost:8081/explorer/compare?compare=JPN,FRA');
    await page.waitForTimeout(1500);
    await shot(page, `${label}-compare`);
    results.push({
      label,
      route: '/compare?JPN,FRA',
      overflow: await checkOverflow(page),
      hasJapan: (await page.getByText(/Japan/i).count()) > 0,
      hasFrance: (await page.getByText(/France/i).count()) > 0,
    });

    // Destination detail
    await goto('http://localhost:8081/explorer/JPN');
    await page.waitForTimeout(1500);
    await shot(page, `${label}-detail`);
    const planCta = page.getByText(/Plan This Trip/i).first();
    results.push({
      label,
      route: '/explorer/JPN',
      overflow: await checkOverflow(page),
      hasPlanCta: (await planCta.count()) > 0,
      hasQuickFacts: (await page.getByText(/Quick Facts/i).count()) > 0,
    });

    // Plan prefill from detail CTA if present
    if ((await planCta.count()) > 0) {
      await planCta.click();
      await page.waitForTimeout(1500);
      await shot(page, `${label}-plan-from-detail`);
      results.push({
        label,
        stage: 'plan-from-detail',
        url: page.url(),
        hasJapan: (await page.getByText(/Japan/i).count()) > 0,
        overflow: await checkOverflow(page),
      });
    }

    // Direct plan prefill
    await goto('http://localhost:8081/plan?destination=JPN&name=Japan');
    await shot(page, `${label}-plan`);
    results.push({
      label,
      route: '/plan?destination=JPN',
      overflow: await checkOverflow(page),
      hasJapan: (await page.getByText(/Japan/i).count()) > 0,
      hasIntake: (await page.getByText(/Where|When|destination/i).count()) > 0,
    });

    // About
    await goto('http://localhost:8081/about');
    await shot(page, `${label}-about`);
    results.push({
      label,
      route: '/about',
      overflow: await checkOverflow(page),
      hasHowItWorks: (await page.getByText(/How It Works/i).count()) > 0,
    });

    // /explorer redirect
    await goto('http://localhost:8081/explorer');
    results.push({
      label,
      route: '/explorer',
      finalUrl: page.url(),
      redirectedHome: /\/($|\?)/.test(new URL(page.url()).pathname),
    });

    // Login page reachable
    await goto('http://localhost:8081/login');
    await shot(page, `${label}-login`);
    results.push({
      label,
      route: '/login',
      hasEmail: (await page.getByPlaceholder(/email|company/i).count()) > 0,
      overflow: await checkOverflow(page),
    });

    // Welcome flag persists after dismiss
    await goto('http://127.0.0.1:8081/');
    await page.evaluate(() =>
      localStorage.setItem('outbound_welcome_seen', 'true')
    );
    await page.reload({ waitUntil: 'commit', timeout: 120000 });
    await page.waitForTimeout(2500);
    const welcomeAgain =
      (await page.getByRole('button', { name: /Start Exploring/i }).count()) >
      0;
    results.push({
      label,
      stage: 'welcome-suppressed',
      welcomeAgain,
    });

    if (consoleErrors.length) {
      results.push({
        label,
        consoleErrors: [...new Set(consoleErrors)].slice(0, 12),
      });
    }

    await context.close();
  }

  await runViewport(375, 667, 'mobile');
  await runViewport(768, 900, 'tablet');
  await runViewport(1280, 800, 'desktop');

  // Explicit 767 vs 768 shell check
  for (const w of [767, 768]) {
    const context = await browser.newContext({
      viewport: { width: w, height: 800 },
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8081/', {
      waitUntil: 'commit',
      timeout: 120000,
    });
    await page.evaluate(() =>
      localStorage.setItem('outbound_welcome_seen', 'true')
    );
    await page.reload({ waitUntil: 'commit', timeout: 120000 });
    await page.waitForTimeout(3000);
    const probe = await layoutProbe(page);
    await shot(page, `breakpoint-${w}`);
    results.push({
      label: `bp-${w}`,
      width: w,
      hasSidebar: probe.hasSidebar,
      expectSidebar: w >= 768,
      ok: probe.hasSidebar === w >= 768,
    });
    await context.close();
  }

  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
