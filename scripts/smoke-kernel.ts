import Kernel from "@onkernel/sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.KERNEL_API_KEY;
if (!apiKey) {
  console.error("❌ KERNEL_API_KEY is not set in .env");
  process.exit(1);
}

async function runKernelSmoke() {
  console.log("=== Kernel Browser Smoke Test ===");
  const kernel = new Kernel({ apiKey });

  let sessionId: string | null = null;
  try {
    console.log("1. Creating Kernel cloud browser session...");
    const browser = await kernel.browsers.create();
    sessionId = browser.session_id;
    console.log(`✓ Browser session created: ${sessionId}`);

    console.log("2. Navigating to https://example.com & taking screenshot...");
    const response = await kernel.browsers.playwright.execute(sessionId, {
      code: `
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        const title = await page.title();
        const screenshot = await page.screenshot({ fullPage: false });
        return {
          title,
          screenshotBase64: screenshot.toString('base64')
        };
      `,
    });

    const result = response.result as { title: string; screenshotBase64: string };
    console.log(`✓ Page Title received: "${result.title}"`);

    if (result.screenshotBase64) {
      const outDir = path.resolve("./artifacts");
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outPath = path.join(outDir, "smoke-kernel-example.png");
      fs.writeFileSync(outPath, Buffer.from(result.screenshotBase64, "base64"));
      console.log(`✓ Screenshot successfully saved to ${outPath} (${Buffer.from(result.screenshotBase64, "base64").length} bytes)`);
    } else {
      console.log("⚠️ No screenshot data returned");
    }

    console.log("=== Kernel Smoke Test: SUCCESS ===");
  } catch (error: any) {
    console.error("❌ Kernel Smoke Test failed:", error.message || error);
    process.exitCode = 1;
  } finally {
    if (sessionId) {
      console.log(`3. Cleaning up browser session ${sessionId}...`);
      try {
        await kernel.browsers.deleteByID(sessionId);
        console.log("✓ Browser session deleted successfully.");
      } catch (cleanupErr: any) {
        console.error("Warning: failed to delete browser session:", cleanupErr.message);
      }
    }
  }
}

runKernelSmoke();

