import Kernel from "@onkernel/sdk";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "@/config/env";
import { getMockTracking, type MockCarrierStatus } from "./mock-carrier-store";
import { generateMockCarrierHtml } from "./html-template";
import { hashEvidenceContent } from "@/domain/evidence";

export interface TrackingVerificationResult {
  trackingNumber: string;
  carrier: string;
  status: MockCarrierStatus | "Unknown";
  statusText: string;
  screenshotUrl?: string;
  replayUrl?: string;
  contentHash: string;
  verifiedAt: Date;
}

const ALLOWED_CARRIERS = ["mock carrier", "referee parcel express", "usps", "fedex", "dhl", "ups"];

/**
 * Validates carrier against allow-list per requirements.md 10.5.
 */
export function isCarrierAllowed(carrier: string): boolean {
  const norm = carrier.trim().toLowerCase();
  return ALLOWED_CARRIERS.some((allowed) => norm.includes(allowed));
}

/**
 * Verifies shipment tracking via a real Kernel cloud browser session.
 * AGENTS.md 3.1 & requirements.md 10.5:
 * 1. Allow-list validation.
 * 2. Real cloud browser session with Playwright code execution.
 * 3. Screenshot capture and status extraction.
 * 4. Always cleans up browser session in finally block.
 * 5. Retries on transient errors with exponential backoff.
 */
export async function verifyTrackingWithKernel(
  trackingNumber: string,
  carrier: string = "Mock Carrier"
): Promise<TrackingVerificationResult> {
  if (!isCarrierAllowed(carrier)) {
    throw new Error(
      `Carrier '${carrier}' is not in the allowed carriers list. Permitted: ${ALLOWED_CARRIERS.join(", ")}`
    );
  }

  const apiKey = env.KERNEL_API_KEY || process.env.KERNEL_API_KEY;
  if (!apiKey) {
    throw new Error("KERNEL_API_KEY is not configured in environment.");
  }

  const kernel = new Kernel({ apiKey });

  // Determine whether we can browse a public URL or should render HTML in cloud browser
  const appUrl = env.APP_URL || "http://localhost:3000";
  const isLocalhost = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");

  const mockRecord = getMockTracking(trackingNumber);
  const inlineHtml = generateMockCarrierHtml(mockRecord);

  let sessionId: string | null = null;
  let attempt = 0;
  const maxRetries = 2;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      const browser = await kernel.browsers.create();
      sessionId = browser.session_id;

      // Safe escaped HTML string for Playwright execution
      const sanitizedHtml = JSON.stringify(inlineHtml);
      const targetUrl = `${appUrl}/mock-carrier/${encodeURIComponent(trackingNumber)}`;

      const playwrightScript = isLocalhost
        ? `
          await page.setContent(${sanitizedHtml}, { waitUntil: 'domcontentloaded' });
          const statusEl = await page.$('#tracking-status');
          const statusText = statusEl ? (await statusEl.textContent()) || '' : await page.innerText('body');
          const title = await page.title();
          const screenshot = await page.screenshot({ fullPage: false });
          return {
            statusText: statusText.trim(),
            title,
            screenshotBase64: screenshot.toString('base64')
          };
        `
        : `
          await page.goto('${targetUrl}', { waitUntil: 'domcontentloaded', timeout: 20000 });
          const statusEl = await page.$('#tracking-status');
          const statusText = statusEl ? (await statusEl.textContent()) || '' : await page.innerText('body');
          const title = await page.title();
          const screenshot = await page.screenshot({ fullPage: false });
          return {
            statusText: statusText.trim(),
            title,
            screenshotBase64: screenshot.toString('base64')
          };
        `;

      const response = await kernel.browsers.playwright.execute(sessionId, {
        code: playwrightScript,
      });

      const execResult = response.result as {
        statusText: string;
        title: string;
        screenshotBase64?: string;
      };

      const rawStatusText = execResult.statusText || "";
      let parsedStatus: MockCarrierStatus | "Unknown" = "Unknown";

      if (rawStatusText.toLowerCase().includes("delivered")) {
        parsedStatus = "Delivered";
      } else if (rawStatusText.toLowerCase().includes("returned")) {
        parsedStatus = "Returned";
      } else if (rawStatusText.toLowerCase().includes("in transit")) {
        parsedStatus = "In transit";
      } else if (rawStatusText.toLowerCase().includes("label created")) {
        parsedStatus = "Label created";
      }

      // Persist screenshot artifact
      let screenshotUrl: string | undefined;
      if (execResult.screenshotBase64) {
        try {
          const artifactsDir = path.resolve("./public/artifacts/screenshots");
          if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true });
          }
          const filename = `kernel-${trackingNumber}-${Date.now()}.png`;
          const filePath = path.join(artifactsDir, filename);
          fs.writeFileSync(filePath, Buffer.from(execResult.screenshotBase64, "base64"));
          screenshotUrl = `/artifacts/screenshots/${filename}`;
        } catch {
          // If disk write fails, fallback to inline data URL
          screenshotUrl = `data:image/png;base64,${execResult.screenshotBase64}`;
        }
      }

      const replayUrl = `https://app.kernel.sh/sessions/${sessionId}`;
      const evidencePayload = `Status: ${parsedStatus} | Tracking: ${trackingNumber} | Carrier: ${carrier} | Details: ${rawStatusText}`;
      const contentHash = hashEvidenceContent(evidencePayload);

      return {
        trackingNumber,
        carrier,
        status: parsedStatus,
        statusText: evidencePayload,
        screenshotUrl,
        replayUrl,
        contentHash,
        verifiedAt: new Date(),
      };
    } catch (err: any) {
      console.warn(`Kernel verification attempt ${attempt} failed: ${err.message}`);
      if (attempt > maxRetries) {
        throw new Error(
          `Kernel browser tracking verification failed after ${maxRetries} retries: ${err.message}`
        );
      }
      // Exponential backoff
      await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
    } finally {
      if (sessionId) {
        try {
          await kernel.browsers.deleteByID(sessionId);
        } catch (cleanupErr: any) {
          console.warn("Failed to delete Kernel browser session:", cleanupErr.message);
        }
        sessionId = null;
      }
    }
  }

  throw new Error("Kernel browser verification could not be completed.");
}

