import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/demo/carrier", () => {
  it("updates mock carrier tracking status successfully", async () => {
    const req = new Request("http://localhost:3000/api/demo/carrier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackingNumber: "TRK-DEMO-ROUTE",
        status: "Delivered",
        location: "Front Porch, Delivered to Customer",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.record.status).toBe("Delivered");
    expect(data.record.location).toBe("Front Porch, Delivered to Customer");
  });

  it("returns 400 when invalid status is passed", async () => {
    const req = new Request("http://localhost:3000/api/demo/carrier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackingNumber: "TRK-DEMO-ROUTE",
        status: "LostInSpace",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid request payload");
  });
});

