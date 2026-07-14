import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.env.PREVIEW_URL ?? "http://127.0.0.1:4321/automaticDevelopment/";
mkdirSync("test-results", { recursive: true });

async function canvasHasPixels(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas[data-tech-core]");
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    const width = Math.min(canvas.width, 96);
    const height = Math.min(canvas.height, 96);
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0 && (data[index - 1] > 0 || data[index - 2] > 0 || data[index - 3] > 0)) {
        return true;
      }
    }
    return false;
  });
}

async function verifyCopyButton(page, cardSelector) {
  const promptText = await page.locator(`${cardSelector} pre > code`).textContent();
  await page.locator(`${cardSelector} .copy-code-button`).click();
  await page.waitForFunction(
    (selector) => document.querySelector(`${selector} .copy-code-button`)?.textContent === "Copied",
    cardSelector,
  );
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  if (clipboardText !== promptText) {
    throw new Error(`${cardSelector} copy button did not write the expected clipboard text.`);
  }
}

const browser = await chromium.launch();

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await desktopContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(url).origin });
  const desktop = await desktopContext.newPage();
  await desktop.goto(url, { waitUntil: "networkidle" });
  await desktop.screenshot({ path: "test-results/desktop.png", fullPage: true });
  const title = await desktop.locator("h1").textContent();
  if (!title?.includes("Plan globally")) {
    throw new Error("Desktop hero heading did not render expected text.");
  }
  const codeBlockCount = await desktop.locator("pre > code").count();
  const copyButtonCount = await desktop.locator(".copy-code-button").count();
  if (codeBlockCount < 1 || copyButtonCount !== codeBlockCount) {
    throw new Error(`Copy buttons missing. Found ${copyButtonCount} buttons for ${codeBlockCount} code blocks.`);
  }
  await verifyCopyButton(desktop, ".code-card");
  await desktop.waitForTimeout(900);
  if (!(await canvasHasPixels(desktop))) {
    throw new Error("Tech Core canvas appears blank on desktop.");
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(url, { waitUntil: "networkidle" });
  await mobile.screenshot({ path: "test-results/mobile.png", fullPage: true });
  const mobileCta = await mobile.locator("text=Start Quickstart").count();
  if (mobileCta < 1) {
    throw new Error("Mobile Quickstart CTA missing.");
  }
  const mobileGrowthPhase = await mobile.locator("text=Growth").count();
  if (mobileGrowthPhase < 1) {
    throw new Error("Mobile lifecycle phases are incomplete.");
  }
  const noMobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (!noMobileOverflow) {
    throw new Error("Mobile page has horizontal overflow.");
  }

  const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await reduced.goto(url, { waitUntil: "networkidle" });
  const staticFlag = await reduced.locator(".tech-core-panel[data-tech-core-static='true']").count();
  if (staticFlag !== 1) {
    throw new Error("Reduced-motion Tech Core fallback did not activate.");
  }

  const docs = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await docs.goto(new URL("docs/pre-pr-gate/", url).toString(), { waitUntil: "networkidle" });
  if ((await docs.locator("h1", { hasText: "Strict pre-PR admission" }).count()) !== 1) {
    throw new Error("Canonical Markdown docs route did not render.");
  }

  const planning = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await planning.goto(new URL("docs/planning/", url).toString(), { waitUntil: "networkidle" });
  if ((await planning.locator("text=Global Planner prompt — EN").count()) !== 1
    || (await planning.locator("text=Промпт Global Planner — RU").count()) !== 1
    || (await planning.locator("pre > code").count()) < 4) {
    throw new Error("Canonical EN/RU Planner prompts did not render.");
  }

  const orchestration = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await orchestration.goto(new URL("docs/orchestration/", url).toString(), { waitUntil: "networkidle" });
  const topology = orchestration.locator("img[alt*='Canonical task topology']");
  if ((await topology.count()) !== 1 || !(await topology.evaluate((image) => image.complete && image.naturalWidth > 0))) {
    throw new Error("Canonical task topology did not render as an image.");
  }

  console.log("PASS: visual checks completed");
} finally {
  await browser.close();
}
