export type MockCarrierStatus =
  | "Label created"
  | "In transit"
  | "Delivered"
  | "Returned";

export interface MockTrackingRecord {
  trackingNumber: string;
  carrier: string;
  status: MockCarrierStatus;
  location: string;
  estimatedDelivery?: string;
  history: Array<{
    status: MockCarrierStatus;
    location: string;
    timestamp: string;
  }>;
  updatedAt: Date;
}

// Global in-memory map for the runtime (persists across requests in Node server)
const trackingMap = new Map<string, MockTrackingRecord>();

export function getMockTracking(trackingNumber: string): MockTrackingRecord {
  const existing = trackingMap.get(trackingNumber);
  if (existing) {
    return existing;
  }

  // Derive initial status based on suffix or default to 'In transit'
  let initialStatus: MockCarrierStatus = "In transit";
  let location = "Regional Logistics Facility, Hub 7";

  if (trackingNumber.toUpperCase().includes("DELIV")) {
    initialStatus = "Delivered";
    location = "Front Porch / Mailbox, Destination";
  } else if (trackingNumber.toUpperCase().includes("RET")) {
    initialStatus = "Returned";
    location = "Returned to Sender Warehouse";
  } else if (trackingNumber.toUpperCase().includes("LABEL")) {
    initialStatus = "Label created";
    location = "Origin Facility";
  }

  const initialRecord: MockTrackingRecord = {
    trackingNumber,
    carrier: "Referee Parcel Express",
    status: initialStatus,
    location,
    estimatedDelivery: "Within 2 business days",
    history: [
      {
        status: "Label created",
        location: "Origin Shipping Center",
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        status: "In transit",
        location: "Regional Logistics Facility, Hub 7",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    updatedAt: new Date(),
  };

  if (initialStatus === "Delivered") {
    initialRecord.history.push({
      status: "Delivered",
      location: "Front Porch / Mailbox, Destination",
      timestamp: new Date().toISOString(),
    });
  } else if (initialStatus === "Returned") {
    initialRecord.history.push({
      status: "Returned",
      location: "Returned to Sender Warehouse",
      timestamp: new Date().toISOString(),
    });
  }

  trackingMap.set(trackingNumber, initialRecord);
  return initialRecord;
}

export function updateMockTracking(
  trackingNumber: string,
  status: MockCarrierStatus,
  location?: string
): MockTrackingRecord {
  const record = getMockTracking(trackingNumber);
  record.status = status;
  if (location) {
    record.location = location;
  } else {
    if (status === "Delivered") {
      record.location = "Delivered: Front Door / Recipient Address";
    } else if (status === "Returned") {
      record.location = "Return to Sender Facility";
    } else if (status === "In transit") {
      record.location = "En Route - Regional Transit Depot";
    }
  }

  record.history.push({
    status,
    location: record.location,
    timestamp: new Date().toISOString(),
  });
  record.updatedAt = new Date();

  trackingMap.set(trackingNumber, record);
  return record;
}

