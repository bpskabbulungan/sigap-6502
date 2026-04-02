import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_IMAGES_DIR = path.resolve(__dirname, "../../../docs/images");

const DAILY_TIMES = {
  1: "16:00",
  2: "16:00",
  3: "16:00",
  4: "16:00",
  5: "16:30",
  6: null,
  7: null,
};

const THEMED_CAPTURES = [
  {
    filePrefix: "public-home",
    path: "/",
    authenticated: false,
    readyText: "SIGAP 6502",
  },
  {
    filePrefix: "login",
    path: "/admin/login",
    authenticated: false,
    readyText: "Masuk ke Dashboard",
  },
  {
    filePrefix: "dashboard",
    path: "/admin/dashboard",
    authenticated: true,
    readyText: "Panel Operasional",
  },
  {
    filePrefix: "kalender",
    path: "/admin/holidays",
    authenticated: true,
    readyText: "Manajemen Kalender",
  },
  {
    filePrefix: "kontak",
    path: "/admin/contacts",
    authenticated: true,
    readyText: "Manajemen Kontak Pegawai",
  },
  {
    filePrefix: "templat",
    path: "/admin/templates",
    authenticated: true,
    readyText: "Manajemen Templat Pesan",
  },
  {
    filePrefix: "kutipan",
    path: "/admin/quotes",
    authenticated: true,
    readyText: "Manajemen Kutipan",
  },
];

const STATIC_CAPTURES = [
  {
    fileName: "error-404.png",
    path: "/halaman-tidak-ada",
    readyText: "Halaman tidak ditemukan",
  },
  {
    fileName: "error-500.png",
    path: "/error/500",
    readyText: "Terjadi gangguan pada sistem",
  },
];

function fulfillJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function registerApiMocks(page, { authenticated }) {
  page.route("**/socket.io/**", (route) => route.abort());

  page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const { pathname } = new URL(request.url());

    if (method === "OPTIONS") {
      return route.fulfill({ status: 204, body: "" });
    }

    if (pathname === "/api/auth/session") {
      if (authenticated) {
        return fulfillJson(route, {
          authenticated: true,
          user: { username: "admin" },
        });
      }
      return fulfillJson(route, {
        authenticated: false,
        user: null,
      });
    }

    if (pathname === "/api/system/health") {
      return fulfillJson(route, {
        botActive: true,
        botPhase: "ready",
        botStatus: { active: true, phase: "ready" },
        timezone: "Asia/Makassar",
      });
    }

    if (pathname === "/api/schedule") {
      return fulfillJson(route, {
        schedule: {
          timezone: "Asia/Makassar",
          paused: false,
          dailyTimes: DAILY_TIMES,
          announcementsCount: 1,
          overridesCount: 1,
        },
      });
    }

    if (pathname === "/api/schedule/next-run") {
      return fulfillJson(route, {
        nextRun: {
          timestamp: "2026-04-03T08:00:00.000Z",
          formatted: "Jumat, 03-04-2026 16:00",
          timezone: "Asia/Makassar",
          manualEvent: {
            date: "03-04-2026",
            time: "16:00",
            note: "Koordinasi tim",
          },
        },
      });
    }

    if (pathname === "/api/admin/schedule") {
      return fulfillJson(route, {
        schedule: {
          timezone: "Asia/Makassar",
          paused: false,
          dailyTimes: DAILY_TIMES,
          manualOverrides: [
            {
              id: "ovr-001",
              date: "03-04-2026",
              time: "16:00",
              note: "Koordinasi tim",
            },
          ],
          announcementsCount: 1,
          overridesCount: 1,
        },
      });
    }

    if (pathname === "/api/admin/schedule/next-run") {
      return fulfillJson(route, {
        nextRun: {
          timestamp: "2026-04-03T08:00:00.000Z",
          formatted: "Jumat, 03-04-2026 16:00",
          timezone: "Asia/Makassar",
          announcement: {
            id: "ovr-001",
            date: "03-04-2026",
            time: "16:00",
            note: "Koordinasi tim",
          },
        },
      });
    }

    if (pathname === "/api/admin/bot/status") {
      return fulfillJson(route, {
        active: true,
        phase: "ready",
      });
    }

    if (pathname === "/api/system/qr") {
      return fulfillJson(route, {
        qr: null,
      });
    }

    if (pathname === "/api/system/logs") {
      return fulfillJson(route, {
        logs: [
          "[INFO] Scheduler started",
          "[INFO] Next run resolved",
          "[INFO] Message sent to 24 contacts",
          "[INFO] Daily summary sent successfully",
        ],
      });
    }

    if (pathname === "/api/system/stats") {
      return fulfillJson(route, {
        messagesPerDay: {
          "26-03-2026": 18,
          "27-03-2026": 21,
          "28-03-2026": 19,
          "29-03-2026": 20,
          "30-03-2026": 25,
          "31-03-2026": 24,
          "01-04-2026": 23,
        },
        errorsPerDay: {
          "26-03-2026": 0,
          "27-03-2026": 1,
          "28-03-2026": 0,
          "29-03-2026": 0,
          "30-03-2026": 1,
          "31-03-2026": 0,
          "01-04-2026": 0,
        },
        uptimePerDay: {
          "26-03-2026": 24,
          "27-03-2026": 23,
          "28-03-2026": 24,
          "29-03-2026": 24,
          "30-03-2026": 24,
          "31-03-2026": 24,
          "01-04-2026": 24,
        },
      });
    }

    if (pathname === "/api/admin/contacts") {
      return fulfillJson(route, {
        contacts: [
          {
            id: "ct-001",
            name: "Andi Saputra",
            number: "081234567890",
            status: "masuk",
            updatedAt: "2026-04-01T07:30:00.000Z",
          },
          {
            id: "ct-002",
            name: "Bunga Permata",
            number: "081355512312",
            status: "izin",
            updatedAt: "2026-04-01T07:45:00.000Z",
          },
          {
            id: "ct-003",
            name: "Cahyo Prasetyo",
            number: "081377788899",
            status: "sakit",
            updatedAt: "2026-04-01T08:00:00.000Z",
          },
        ],
        allowedStatuses: ["masuk", "izin", "sakit", "cuti", "dinas_luar"],
      });
    }

    if (pathname === "/api/admin/calendar") {
      return fulfillJson(route, {
        calendar: {
          LIBURAN: ["17-08-2026", "25-12-2026"],
          CUTI_BERSAMA: ["26-12-2026"],
        },
      });
    }

    if (pathname === "/api/admin/templates/raw") {
      return fulfillJson(route, {
        templates: [
          {
            id: "default-reminder",
            content:
              "Halo {name},\\n{quote}\\nJangan lupa presensi hari ini sebelum pukul 16:00.",
            isActive: true,
            updatedAt: "2026-04-01T08:15:00.000Z",
          },
        ],
        activeTemplateId: "default-reminder",
      });
    }

    if (pathname === "/api/quotes") {
      return fulfillJson(route, {
        quotes: [
          {
            id: 1,
            content: "Disiplin adalah jembatan antara tujuan dan pencapaian.",
          },
          {
            id: 2,
            content: "Ketepatan waktu adalah bentuk profesionalisme paling nyata.",
          },
          {
            id: 3,
            content: "Konsisten presensi, konsisten kinerja.",
          },
        ],
      });
    }

    if (pathname.startsWith("/api/")) {
      return fulfillJson(route, {});
    }

    return route.continue();
  });
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

async function capture(page, {
  routePath,
  outputFile,
  readyText,
  theme,
  authenticated,
}) {
  registerApiMocks(page, { authenticated });
  await setTheme(page, theme);

  await page.goto(routePath, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  if (readyText) {
    await page.getByText(readyText, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 20_000,
    });
  }

  await page.waitForTimeout(500);
  await stabilizeVisual(page);

  await page.screenshot({
    path: path.join(DOCS_IMAGES_DIR, outputFile),
    fullPage: false,
  });
}

test("generate README screenshots", async ({ page }) => {
  await fs.mkdir(DOCS_IMAGES_DIR, { recursive: true });

  for (const item of THEMED_CAPTURES) {
    for (const theme of ["light", "dark"]) {
      const outputFile = `${item.filePrefix}-${theme}.png`;
      await capture(page, {
        routePath: item.path,
        outputFile,
        readyText: item.readyText,
        theme,
        authenticated: item.authenticated,
      });
    }
  }

  for (const item of STATIC_CAPTURES) {
    await capture(page, {
      routePath: item.path,
      outputFile: item.fileName,
      readyText: item.readyText,
      theme: "light",
      authenticated: false,
    });
  }
});
