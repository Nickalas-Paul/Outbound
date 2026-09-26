const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', '.integration-shots');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://127.0.0.1:8081';
const failures = [];

function fail(label, message) {
  failures.push(`${label}: ${message}`);
  console.error(`FAIL [${label}] ${message}`);
}

function expect(label, condition, message) {
  if (!condition) fail(label, message);
}

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
    };
  });
}

async function goto(page, url) {
  await page.goto(url.replace('localhost', '127.0.0.1'), {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
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
    await goto(page, `${BASE}/`);
    await page.evaluate(() => localStorage.removeItem('outbound_welcome_seen'));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });

    const welcomeCta = page.getByRole('button', { name: /Start Exploring/i });
    try {
      await welcomeCta.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // If welcome already dismissed somehow, continue — but record failure below
    }
    const welcomeVisible = await welcomeCta.isVisible().catch(() => false);
    expect(label, welcomeVisible, 'welcome overlay Start Exploring not visible after clearing flag');
    await shot(page, `${label}-welcome`);
    results.push({
      label,
      route: '/',
      stage: 'welcome',
      welcomeVisible,
      overflow: await checkOverflow(page),
    });

    if (welcomeVisible) {
      await welcomeCta.click();
      await page
        .getByRole('button', { name: /Start Exploring/i })
        .waitFor({ state: 'hidden', timeout: 10000 })
        .catch(() => {});
    }
    await shot(page, `${label}-explorer`);
    const probe = await layoutProbe(page);
    const sidebarOk = width >= 768 ? probe.hasSidebar : !probe.hasSidebar;
    expect(
      label,
      sidebarOk,
      `sidebar expected=${width >= 768} actual=${probe.hasSidebar}`
    );
    results.push({
      label,
      route: '/',
      stage: 'explorer',
      overflow: await checkOverflow(page),
      layout: probe,
      sidebarExpected: width >= 768,
      sidebarOk,
    });

    // Filters FAB (mobile only)
    if (width < 768) {
      const filtersBtn = page.getByText(/^Filters$/i).first();
      if ((await filtersBtn.count()) > 0) {
        await filtersBtn.click();
        await page.waitForTimeout(500);
        await shot(page, `${label}-filters-sheet`);
        results.push({
          label,
          stage: 'filters-sheet',
          overflow: await checkOverflow(page),
        });
        await page.keyboard.press('Escape');
      }
    }

    // Compare — wait for Japan/France text
    await goto(page, `${BASE}/explorer/compare?compare=JPN,FRA`);
    try {
      await page.getByText(/Japan/i).first().waitFor({ state: 'visible', timeout: 20000 });
      await page.getByText(/France/i).first().waitFor({ state: 'visible', timeout: 20000 });
    } catch (err) {
      fail(label, `compare missing Japan/France: ${err}`);
    }
    await shot(page, `${label}-compare`);
    const hasJapan = (await page.getByText(/Japan/i).count()) > 0;
    const hasFrance = (await page.getByText(/France/i).count()) > 0;
    expect(label, hasJapan && hasFrance, 'compare page missing Japan or France');
    results.push({
      label,
      route: '/compare?JPN,FRA',
      overflow: await checkOverflow(page),
      hasJapan,
      hasFrance,
    });

    // Destination detail
    await goto(page, `${BASE}/explorer/JPN`);
    const planCta = page.getByText(/Plan This Trip/i).first();
    try {
      await planCta.waitFor({ state: 'visible', timeout: 20000 });
    } catch {
      fail(label, 'Plan This Trip CTA not visible on destination detail');
    }
    await shot(page, `${label}-detail`);
    results.push({
      label,
      route: '/explorer/JPN',
      overflow: await checkOverflow(page),
      hasPlanCta: (await planCta.count()) > 0,
      hasQuickFacts: (await page.getByText(/Quick Facts/i).count()) > 0,
    });

    if ((await planCta.count()) > 0) {
      await planCta.click();
      try {
        await page.getByText(/Japan/i).first().waitFor({ state: 'visible', timeout: 15000 });
      } catch {
        fail(label, 'plan-from-detail missing Japan prefill');
      }
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
    await goto(page, `${BASE}/plan?destination=JPN&name=Japan`);
    try {
      await page.getByText(/Japan/i).first().waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      fail(label, 'plan prefill missing Japan');
    }
    await shot(page, `${label}-plan`);
    results.push({
      label,
      route: '/plan?destination=JPN',
      overflow: await checkOverflow(page),
      hasJapan: (await page.getByText(/Japan/i).count()) > 0,
      hasIntake: (await page.getByText(/Where|When|destination/i).count()) > 0,
    });

    // About — How it works
    await goto(page, `${BASE}/about`);
    try {
      await page.getByText(/How it works/i).first().waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      fail(label, 'About page missing How it works');
    }
    await shot(page, `${label}-about`);
    results.push({
      label,
      route: '/about',
      overflow: await checkOverflow(page),
      hasHowItWorks: (await page.getByText(/How it works/i).count()) > 0,
    });

    // /explorer redirect (client-side; wait past domcontentloaded)
    await goto(page, `${BASE}/explorer`);
    try {
      await page.waitForURL(
        (url) => {
          const path = new URL(url).pathname;
          return path === '/' || path === '';
        },
        { timeout: 20000 }
      );
    } catch {
      fail(label, `/explorer did not redirect home: ${page.url()}`);
    }
    const redirectedHome = /\/($|\?)/.test(new URL(page.url()).pathname);
    expect(label, redirectedHome, `/explorer did not redirect home: ${page.url()}`);
    results.push({
      label,
      route: '/explorer',
      finalUrl: page.url(),
      redirectedHome,
    });

    // Login — placeholder
    await goto(page, `${BASE}/login`);
    const emailInput = page.getByPlaceholder('you@company.com');
    try {
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      fail(label, 'login email placeholder you@company.com not found');
    }
    await shot(page, `${label}-login`);
    results.push({
      label,
      route: '/login',
      hasEmail: (await emailInput.count()) > 0,
      overflow: await checkOverflow(page),
    });

    // Welcome flag persists after dismiss
    await goto(page, `${BASE}/`);
    await page.evaluate(() =>
      localStorage.setItem('outbound_welcome_seen', 'true')
    );
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    // Give async hasSeenWelcome a moment, then assert Start Exploring is gone
    await page
      .getByRole('button', { name: /Start Exploring/i })
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => {
        fail(label, 'welcome still visible after outbound_welcome_seen=true');
      })
      .catch(() => {
        // expected — not visible
      });
    const welcomeAgain = await page
      .getByRole('button', { name: /Start Exploring/i })
      .isVisible()
      .catch(() => false);
    expect(label, !welcomeAgain, 'welcome should stay suppressed when already seen');
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

  // Explicit 767 vs 768 shell check — wait for sidebar at 768
  for (const w of [767, 768]) {
    const context = await browser.newContext({
      viewport: { width: w, height: 800 },
    });
    const page = await context.newPage();
    await goto(page, `${BASE}/`);
    await page.evaluate(() =>
      localStorage.setItem('outbound_welcome_seen', 'true')
    );
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });

    if (w >= 768) {
      try {
        await page.waitForFunction(
          () => {
            return Array.from(document.querySelectorAll('*')).some((el) => {
              const t = (el.textContent || '').trim();
              return (
                t.startsWith('Outbound') &&
                t.includes('Explorer') &&
                t.includes('About') &&
                el.getBoundingClientRect().width > 150 &&
                el.getBoundingClientRect().width < 280
              );
            });
          },
          { timeout: 20000 }
        );
      } catch {
        fail(`bp-${w}`, 'sidebar not found within timeout');
      }
    } else {
      await page.waitForTimeout(1500);
    }

    const probe = await layoutProbe(page);
    await shot(page, `breakpoint-${w}`);
    const ok = probe.hasSidebar === w >= 768;
    expect(`bp-${w}`, ok, `sidebar expected=${w >= 768} actual=${probe.hasSidebar}`);
    results.push({
      label: `bp-${w}`,
      width: w,
      hasSidebar: probe.hasSidebar,
      expectSidebar: w >= 768,
      ok,
    });
    await context.close();
  }

  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify({ results, failures }, null, 2)
  );
  console.log(JSON.stringify({ results, failures }, null, 2));
  await browser.close();

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed`);
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
