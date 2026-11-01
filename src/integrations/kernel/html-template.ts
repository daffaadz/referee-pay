import { getMockTracking, type MockTrackingRecord } from "./mock-carrier-store";

export function generateMockCarrierHtml(record: MockTrackingRecord): string {
  const isDelivered = record.status === "Delivered";
  const isReturned = record.status === "Returned";

  const badgeColor = isDelivered
    ? "background-color: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;"
    : isReturned
    ? "background-color: #ffe4e6; color: #9f1239; border: 1px solid #fda4af;"
    : "background-color: #dbeafe; color: #1e40af; border: 1px solid #93c5fd;";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${record.carrier} - Tracking ${record.trackingNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px 16px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px; }
    .carrier { font-size: 20px; font-weight: 800; color: #1e293b; }
    .tracking-num { font-size: 13px; color: #64748b; font-family: monospace; margin-top: 4px; }
    .status-badge { padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; ${badgeColor} }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px; margin-bottom: 24px; }
    .info-label { color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .info-value { font-weight: 700; color: #1e293b; margin-top: 2px; }
    .stepper { display: flex; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .step { text-align: center; flex: 1; }
    .step-circle { width: 28px; height: 28px; border-radius: 50%; margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; background: #e2e8f0; color: #64748b; }
    .step-circle.active { background: #059669; color: white; }
    .step-title { font-size: 11px; font-weight: 600; color: #334155; }
    .history { margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; }
    .history-item { margin-bottom: 12px; padding-left: 12px; border-left: 2px solid #3b82f6; }
    .badge-sim { background: #eff6ff; color: #1d4ed8; font-size: 11px; padding: 4px 8px; border-radius: 6px; margin-bottom: 16px; display: inline-block; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge-sim">📦 Verified Carrier Tracking Portal — Referee Verification</div>
    <div class="header">
      <div>
        <div id="carrier-name" class="carrier">${record.carrier}</div>
        <div class="tracking-num">Tracking: <span id="tracking-number">${record.trackingNumber}</span></div>
      </div>
      <div>
        <span id="tracking-status" data-status="${record.status}" class="status-badge">${record.status}</span>
      </div>
    </div>
    <div class="info-grid">
      <div>
        <div class="info-label">Latest Activity Location</div>
        <div id="current-location" class="info-value">${record.location}</div>
      </div>
      <div>
        <div class="info-label">Estimated Delivery</div>
        <div class="info-value">${isDelivered ? "Delivered" : record.estimatedDelivery || "In Transit"}</div>
      </div>
    </div>
    <div class="stepper">
      <div class="step">
        <div class="step-circle active">✓</div>
        <div class="step-title">Label created</div>
      </div>
      <div class="step">
        <div class="step-circle ${record.status === "In transit" || isDelivered ? "active" : ""}">
          ${record.status === "In transit" || isDelivered ? "✓" : "2"}
        </div>
        <div class="step-title">In transit</div>
      </div>
      <div class="step">
        <div class="step-circle ${isDelivered ? "active" : ""}">
          ${isDelivered ? "✓" : "3"}
        </div>
        <div class="step-title">Delivered</div>
      </div>
    </div>
    <div class="history">
      <strong>Activity History</strong>
      ${record.history
        .map(
          (h) => `
        <div class="history-item">
          <div style="font-weight: 700; color: #1e293b;">${h.status}</div>
          <div style="color: #64748b;">${h.location} - ${new Date(h.timestamp).toLocaleTimeString()}</div>
        </div>
      `
        )
        .join("")}
    </div>
  </div>
</body>
</html>`;
}

