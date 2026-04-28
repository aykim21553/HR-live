import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://hrroom.onrender.com";
const outDir = path.resolve("captures", "hrroom");

async function waitForSettled(page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function screenshot(page, name, fullPage = true) {
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    fullPage
  });
  console.log(`${name}.png`);
}

async function visit(page, url, name) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForSettled(page, 1800);
  await screenshot(page, name);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

  await visit(page, baseUrl, "01-dashboard");

  await visit(page, `${baseUrl}/hrx.html`, "02-hrx");

  await visit(page, `${baseUrl}/tuition/pages/inbox.html`, "03-sophie-admin-inbox");

  await visit(page, `${baseUrl}/tuition/pages/apply.html`, "04-sophie-employee-apply");

  await visit(page, `${baseUrl}/ellis.html`, "05-ellis-feedback");

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await waitForSettled(page, 1200);
  await page
    .evaluate(() => {
      const maybeWindow = window;
      if (typeof maybeWindow.openResumeTool === "function") {
        maybeWindow.openResumeTool();
        return;
      }

      document.getElementById("resume-panel")?.classList.add("open");
    })
    .catch(() => {});
  await waitForSettled(page, 1000);
  await screenshot(page, "06-remy-resume-workspace");

  await visit(page, `${baseUrl}/hr-newsroom.html`, "07-eddy-hr-news");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
