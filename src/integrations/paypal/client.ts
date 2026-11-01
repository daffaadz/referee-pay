import { Client, Environment, OrdersController, PaymentsController } from "@paypal/paypal-server-sdk";
import { env } from "../../config/env";

/**
 * Official PayPal Server SDK client configured for sandbox.
 * AGENTS.md 3.1 & 3.2: Docs first, strictly sandbox.
 */
export const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: env.PAYPAL_CLIENT_ID,
    oAuthClientSecret: env.PAYPAL_CLIENT_SECRET,
  },
  environment: Environment.Sandbox,
});

export const ordersController = new OrdersController(paypalClient);
export const paymentsController = new PaymentsController(paypalClient);

/**
 * Fetches an OAuth 2.0 access token for endpoints not covered by the server SDK (e.g. Payouts v1).
 */
export async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain PayPal OAuth token (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

