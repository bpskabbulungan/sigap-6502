import { expect, test } from "@playwright/test";

const ROUTES = [
  { name: "public-status", path: "/" },
  { name: "admin-login", path: "/admin/login" },
  { name: "not-found", path: "/this-route-does-not-exist" },
];

function mockPublicApi(page) {
  page.route("**/api/system/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        botActive: true,
        botPhase: "ready",
        botStatus: { active: true, phase: "ready" },
        timezone: "Asia/Makassar",
      }),
    });
  });

  page.route("**/api/schedule/public", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schedule: {
          timezone: "Asia/Makassar",
          paused: false,
          dailyTimes: {
            1: "16:00",
            2: "16:00",
            3: "16:00",
            4: "16:00",
            5: "16:30",
            6: null,
            7: null,
          },
          overridesCount: 1,
        },
      }),
    });
  });

  page.route("**/api/schedule/next-run/public", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        nextRun: {
          timestamp: "2026-04-01T08:00:00.000Z",
          formatted: "Rabu, 01-04-2026 16:00",
          timezone: "Asia/Makassar",
          override: {
            date: "01-04-2026",
            time: "16:00",
            note: "Koordinasi tim",
          },
        },
      }),
    });
  });

  page.route("**/api/system/logs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        logs: [
          "[INFO] Scheduler started",
          "[INFO] Next run resolved",
          "[INFO] Message sent to 24 contacts",
        ],
      }),
    });
  });

  page.route("**/api/system/stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        messagesPerDay: {
          "25-03-2026": 22,
          "26-03-2026": 18,
          "27-03-2026": 21,
          "28-03-2026": 19,
          "29-03-2026": 20,
          "30-03-2026": 25,
          "31-03-2026": 24,
        },
        errorsPerDay: {
          "25-03-2026": 1,
          "26-03-2026": 0,
          "27-03-2026": 1,
          "28-03-2026": 0,
          "29-03-2026": 0,
          "30-03-2026": 1,
          "31-03-2026": 0,
        },
        uptimePerDay: {
          "25-03-2026": 24,
          "26-03-2026": 24,
          "27-03-2026": 23,
          "28-03-2026": 24,
          "29-03-2026": 24,
          "30-03-2026": 24,
          "31-03-2026": 24,
        },
      }),
    });
  });

  page.route("**/socket.io/**", (route) => route.abort());
}

async function setTheme(page, theme) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("sigap_theme", value);
  }, theme);
}

async function stabilizeVisual(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });
}

for (const theme of ["light", "dark"]) {
  for (const route of ROUTES) {
    test(`${route.name} ${theme}`, async ({ page }) => {
      mockPublicApi(page);
      await setTheme(page, theme);

      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      await stabilizeVisual(page);

      await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
        fullPage: true,
      });
    });
  }
}
