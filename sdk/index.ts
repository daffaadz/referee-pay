/**
 * Referee TypeScript Client SDK
 * Auto-generated and wrapped from openapi/referee.yaml (OpenAPI 3.1)
 */
import type { paths, operations, components } from "./referee-client";

export type CreateDealRequest = components["schemas"]["CreateDealRequest"];
export type CreateDealResponse = components["schemas"]["CreateDealResponse"];
export type GetDealResponse = components["schemas"]["GetDealResponse"];
export type ConfirmReceiptRequest = components["schemas"]["ConfirmReceiptRequest"];
export type ConfirmReceiptResponse = components["schemas"]["ConfirmReceiptResponse"];
export type OpenClaimRequest = components["schemas"]["OpenClaimRequest"];
export type OpenClaimResponse = components["schemas"]["OpenClaimResponse"];
export type ErrorResponse = components["schemas"]["ErrorResponse"];

export interface RefereeClientOptions {
  baseUrl?: string;
  sessionCookie?: string;
  capabilityToken?: string;
}

export class RefereeClient {
  private baseUrl: string;
  private sessionCookie?: string;
  private capabilityToken?: string;

  constructor(options: RefereeClientOptions = {}) {
    this.baseUrl = (options.baseUrl || "http://127.0.0.1:3000/api").replace(/\/$/, "");
    this.sessionCookie = options.sessionCookie;
    this.capabilityToken = options.capabilityToken;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers || {});
    headers.set("Content-Type", "application/json");

    if (this.sessionCookie) {
      headers.set("Cookie", `referee_session=${this.sessionCookie}`);
    }
    if (this.capabilityToken) {
      headers.set("X-Capability-Token", this.capabilityToken);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.error || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  /**
   * Create a new deal contract (requires seller session)
   */
  async createDeal(deal: CreateDealRequest): Promise<CreateDealResponse> {
    return this.request<CreateDealResponse>("/deals", {
      method: "POST",
      body: JSON.stringify(deal),
    });
  }

  /**
   * Retrieve deal room details and timeline by capability token
   */
  async getDeal(token: string): Promise<GetDealResponse> {
    return this.request<GetDealResponse>(`/deals/${encodeURIComponent(token)}`, {
      method: "GET",
    });
  }

  /**
   * Buyer confirms receipt, releasing escrow
   */
  async confirmReceipt(token: string, body?: ConfirmReceiptRequest): Promise<ConfirmReceiptResponse> {
    return this.request<ConfirmReceiptResponse>(`/deals/${encodeURIComponent(token)}/confirm-receipt`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Open a claim during the inspection window
   */
  async openClaim(token: string, claim: OpenClaimRequest): Promise<OpenClaimResponse> {
    return this.request<OpenClaimResponse>(`/deals/${encodeURIComponent(token)}/claim`, {
      method: "POST",
      body: JSON.stringify(claim),
    });
  }
}

