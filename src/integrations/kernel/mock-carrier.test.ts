import { describe, it, expect } from "vitest";
import { getMockTracking, updateMockTracking } from "./mock-carrier-store";
import { generateMockCarrierHtml } from "./html-template";
import { isCarrierAllowed } from "./client";

describe("Mock Carrier & Allow-list", () => {
  it("generates default tracking record and derives status from tracking number", () => {
    const recordInTransit = getMockTracking("TRK-987654");
    expect(recordInTransit.carrier).toBe("Referee Parcel Express");
    expect(recordInTransit.status).toBe("In transit");
    expect(recordInTransit.history.length).toBeGreaterThanOrEqual(2);

    const recordDelivered = getMockTracking("TRK-DELIV-123");
    expect(recordDelivered.status).toBe("Delivered");

    const recordReturned = getMockTracking("TRK-RET-456");
    expect(recordReturned.status).toBe("Returned");
  });

  it("updates tracking status and updates history", () => {
    const tracking = "TRK-UPDATE-TEST";
    const initial = getMockTracking(tracking);
    expect(initial.status).toBe("In transit");

    const updated = updateMockTracking(tracking, "Delivered", "Front Porch");
    expect(updated.status).toBe("Delivered");
    expect(updated.location).toBe("Front Porch");
    expect(updated.history[updated.history.length - 1].status).toBe("Delivered");
  });

  it("generates valid HTML markup containing carrier tracking elements", () => {
    const record = getMockTracking("TRK-HTML-TEST");
    const html = generateMockCarrierHtml(record);

    expect(html).toContain('id="tracking-status"');
    expect(html).toContain('id="tracking-number"');
    expect(html).toContain('id="carrier-name"');
    expect(html).toContain(record.trackingNumber);
    expect(html).toContain("Referee Parcel Express");
  });

  it("validates carrier allow-list strictly", () => {
    expect(isCarrierAllowed("Mock Carrier")).toBe(true);
    expect(isCarrierAllowed("Referee Parcel Express")).toBe(true);
    expect(isCarrierAllowed("USPS")).toBe(true);
    expect(isCarrierAllowed("FedEx")).toBe(true);
    expect(isCarrierAllowed("DHL Express")).toBe(true);

    expect(isCarrierAllowed("MaliciousUntrustedCarrier")).toBe(false);
    expect(isCarrierAllowed("https://evil-site.com")).toBe(false);
  });
});

