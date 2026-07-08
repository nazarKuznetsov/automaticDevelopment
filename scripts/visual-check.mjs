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

const browser = await chromium.launch();

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await desktopContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(url).origin });
  const desktop = await desktopContext.newPage();
  await desktop.goto(url, { waitUntil: "networkidle" });
  await desktop.screenshot({ path: "test-results/desktop.png", fullPage: true });
  const title = await desktop.locator("h1").textContent();
  if (!title?.includes("GitHub-native agent workflows")) {
    throw new Error("Desktop hero heading did not render expected text.");
  }
  const codeBlockCount = await desktop.locator("pre > code").count();
  const copyButtonCount = await desktop.locator(".copy-code-button").count();
  if (codeBlockCount < 1 || copyButtonCount !== codeBlockCount) {
    throw new Error(`Copy buttons missing. Found ${copyButtonCount} buttons for ${codeBlockCount} code blocks.`);
  }
  const promptText = await desktop.locator(".prompt-card pre > code").textContent();
  await desktop.locator(".prompt-card .copy-code-button").click();
  await desktop.waitForFunction(() => document.querySelector(".prompt-card .copy-code-button")?.textContent === "Copied");
  const clipboardText = await desktop.evaluate(() => navigator.clipboard.readText());
  if (clipboardText !== promptText) {
    throw new Error("Starter prompt copy button did not write the expected clipboard text.");
  }
  await desktop.waitForTimeout(900);
  if (!(await canvasHasPixels(desktop))) {
    throw new Error("Tech Core canvas appears blank on desktop.");
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(url, { waitUntil: "networkidle" });
  await mobile.screenshot({ path: "test-results/mobile.png", fullPage: true });
  const mobileCta = await mobile.locator("text=Start Setup").count();
  if (mobileCta < 1) {
    throw new Error("Mobile Start Setup CTA missing.");
  }

  const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await reduced.goto(url, { waitUntil: "networkidle" });
  const staticFlag = await reduced.locator(".tech-core-panel[data-tech-core-static='true']").count();
  if (staticFlag !== 1) {
    throw new Error("Reduced-motion Tech Core fallback did not activate.");
  }

  console.log("PASS: visual checks completed");
} finally {
  await browser.close();
}
