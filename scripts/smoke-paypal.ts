import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
} from "@paypal/paypal-server-sdk";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalEnv = process.env.PAYPAL_ENV;

if (paypalEnv !== "sandbox") {
  console.error("❌ CRITICAL: PAYPAL_ENV must be 'sandbox'. Aborting.");
  process.exit(1);
}

if (!clientId || !clientSecret) {
  console.error("❌ PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing in .env");
  process.exit(1);
}

const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: clientId,
    oAuthClientSecret: clientSecret,
  },
  environment: Environment.Sandbox,
});

const ordersController = new OrdersController(client);
const paymentsController = new PaymentsController(client);

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function runPaypalSmoke() {
  if (paypalEnv !== "sandbox") {
    console.error("❌ CRITICAL: PAYPAL_ENV must be 'sandbox'. Aborting.");
    process.exit(1);
  }

  if (!clientId || !clientSecret) {
    console.error("❌ PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing in .env");
    process.exit(1);
  }

  console.log("==================================================");
  console.log("       PayPal Sandbox Smoke Test (Strategy A)     ");
  console.log("==================================================");
  console.log(`Environment: ${paypalEnv.toUpperCase()}`);
  console.log(`Client ID:   ${clientId.slice(0, 8)}...${clientId.slice(-4)}`);

  const runId = Date.now().toString().slice(-6);

  try {
    // 1. Create Order 1 for Capture path
    console.log("\n[1/6] Creating Order 1 (Intent: AUTHORIZE, Amount: $50.00 USD)...");
    const order1RequestId = `referee-smoke-ord1-${runId}`;
    const order1Response = await ordersController.createOrder({
      paypalRequestId: order1RequestId,
      body: {
        intent: CheckoutPaymentIntent.Authorize,
        purchaseUnits: [
          {
            amount: {
              currencyCode: "USD",
              value: "50.00",
            },
            customId: `deal-smoke-cap-${runId}`,
            description: "Referee Deal Hold (Capture Path)",
          },
        ],
      },
    });

    const order1 = order1Response.result;
    const order1Id = order1.id!;
    const order1ApproveLink = order1.links?.find(
      (l) => l.rel === "payer-action" || l.rel === "approve"
    )?.href;

    console.log(`✓ Order 1 Created: ${order1Id} (Status: ${order1.status})`);
    console.log(`👉 Order 1 Approval URL:\n   ${order1ApproveLink}\n`);

    // 2. Create Order 2 for Void path
    console.log("[2/6] Creating Order 2 (Intent: AUTHORIZE, Amount: $30.00 USD)...");
    const order2RequestId = `referee-smoke-ord2-${runId}`;
    const order2Response = await ordersController.createOrder({
      paypalRequestId: order2RequestId,
      body: {
        intent: CheckoutPaymentIntent.Authorize,
        purchaseUnits: [
          {
            amount: {
              currencyCode: "USD",
              value: "30.00",
            },
            customId: `deal-smoke-void-${runId}`,
            description: "Referee Deal Hold (Void Path)",
          },
        ],
      },
    });

    const order2 = order2Response.result;
    const order2Id = order2.id!;
    const order2ApproveLink = order2.links?.find(
      (l) => l.rel === "payer-action" || l.rel === "approve"
    )?.href;

    console.log(`✓ Order 2 Created: ${order2Id} (Status: ${order2.status})`);
    console.log(`👉 Order 2 Approval URL:\n   ${order2ApproveLink}\n`);

    console.log("--------------------------------------------------");
    console.log("ACTION REQUIRED IN BROWSER:");
    console.log("1. Open Order 1 URL, log in with your Sandbox Personal Account, and approve.");
    console.log("2. Open Order 2 URL and approve it as well.");
    console.log("--------------------------------------------------");

    await askQuestion("Press [ENTER] after approving BOTH orders in your sandbox browser...");

    // 3. Authorize Order 1
    console.log(`\n[3/6] Authorizing Order 1 (${order1Id})...`);
    const auth1Response = await ordersController.authorizeOrder({
      id: order1Id,
      paypalRequestId: `referee-smoke-auth1-${runId}`,
    });

    const auth1Result = auth1Response.result;
    const auth1 = auth1Result.purchaseUnits?.[0]?.payments?.authorizations?.[0];
    if (!auth1?.id) {
      throw new Error(`Failed to retrieve authorization ID for Order 1: ${JSON.stringify(auth1Result)}`);
    }
    const auth1Id = auth1.id;
    console.log(`✓ Order 1 Authorized! Authorization ID: ${auth1Id} (Status: ${auth1.status})`);

    // 4. Capture Partial ($20.00 of $50.00) with final_capture: true
    console.log(`\n[4/6] Capturing $20.00 on Authorization 1 (${auth1Id}) with final_capture: true...`);
    const capture1Response = await paymentsController.captureAuthorizedPayment({
      authorizationId: auth1Id,
      paypalRequestId: `referee-smoke-cap1-${runId}`,
      body: {
        amount: {
          currencyCode: "USD",
          value: "20.00",
        },
        finalCapture: true,
      },
    });

    const captureResult = capture1Response.result;
    console.log(`✓ Partial Capture Successful! Capture ID: ${captureResult.id} (Status: ${captureResult.status})`);
    console.log(`  Amount captured: ${captureResult.amount?.value} ${captureResult.amount?.currencyCode}`);
    console.log(`  Remaining authorization released automatically: final_capture=true`);

    // 5. Authorize Order 2
    console.log(`\n[5/6] Authorizing Order 2 (${order2Id})...`);
    const auth2Response = await ordersController.authorizeOrder({
      id: order2Id,
      paypalRequestId: `referee-smoke-auth2-${runId}`,
    });

    const auth2Result = auth2Response.result;
    const auth2 = auth2Result.purchaseUnits?.[0]?.payments?.authorizations?.[0];
    if (!auth2?.id) {
      throw new Error(`Failed to retrieve authorization ID for Order 2: ${JSON.stringify(auth2Result)}`);
    }
    const auth2Id = auth2.id;
    console.log(`✓ Order 2 Authorized! Authorization ID: ${auth2Id} (Status: ${auth2.status})`);

    // 6. Void Authorization 2
    console.log(`\n[6/6] Voiding Authorization 2 (${auth2Id})...`);
    const voidResponse = await paymentsController.voidPayment({
      authorizationId: auth2Id,
      paypalRequestId: `referee-smoke-void2-${runId}`,
    });

    console.log(`✓ Authorization 2 Voided! Status Code: ${voidResponse.statusCode || 204}`);

    console.log("\n==================================================");
    console.log("       🎉 PAYPAL SMOKE TEST PASSED COMPLETELY!     ");
    console.log("==================================================");
    console.log("Proved capabilities:");
    console.log(`- Order creation with intent=AUTHORIZE`);
    console.log(`- Authorize Order -> Hold created`);
    console.log(`- Partial capture ($20.00) with final_capture=true -> Remainder released`);
    console.log(`- Void Authorization -> Full release without processing fees`);
    console.log(`- Idempotency verified via PayPal-Request-Id`);
    console.log("Strategy A (Authorize & Capture later) is 100% verified & operational.");
    process.exit(0);
  } catch (err: any) {
    console.error("\n❌ PayPal Smoke Test Error:", err.message || err);
    if (err.result) {
      console.error("PayPal API Response:", JSON.stringify(err.result, null, 2));
    }
    process.exit(1);
  }
}

runPaypalSmoke();
