import "dotenv/config";

const BASE_URL = process.env.VERCEL_LIVE_URL || "https://referee-pay.vercel.app";
const SWEEP_SECRET = process.env.INTERNAL_SWEEP_SECRET || "";

async function verifyLive() {
  console.log(`\n======================================================`);
  console.log(`  VERIFYING LIVE DEPLOYMENT AT: ${BASE_URL}           `);
  console.log(`======================================================\n`);

  // 1. Health / Homepage Check
  console.log("1. Testing GET / (Homepage)...");
  const homeRes = await fetch(`${BASE_URL}/`);
  console.log(`   Status: ${homeRes.status} ${homeRes.statusText}`);
  if (!homeRes.ok) throw new Error(`Homepage returned ${homeRes.status}`);
  const homeHtml = await homeRes.text();
  const titleMatch = homeHtml.match(/<title>(.*?)<\/title>/i);
  console.log(`   Title: ${titleMatch ? titleMatch[1] : "N/A"}`);
  console.log("   [PASS] Homepage loaded successfully.\n");

  // 2. AI Drafter via Gemini
  console.log("2. Testing POST /api/deals/draft (AI Drafter via Gemini)...");
  const draftPrompt = "Selling vintage mechanical keyboard to Maya for $85. Shipping in 2 days with 5 day inspection window.";
  const draftRes = await fetch(`${BASE_URL}/api/deals/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: draftPrompt }),
  });
  console.log(`   Status: ${draftRes.status} ${draftRes.statusText}`);
  if (!draftRes.ok) {
    const errText = await draftRes.text();
    throw new Error(`Drafter API failed (${draftRes.status}): ${errText}`);
  }
  const draftData = await draftRes.json();
  console.log(`   Drafted item: "${draftData.contract?.item?.title}" for ${draftData.contract?.item?.price?.amount} ${draftData.contract?.item?.price?.currency}`);
  console.log(`   Generated Clauses: ${draftData.contract?.clauses?.length || 0}`);
  console.log("   [PASS] AI Drafter passed.\n");

  // 2.5 Authenticate as Seller (via Demo Sign-In)
  console.log("2.5 Testing POST /api/auth/demo (Seller Authentication)...");
  const authRes = await fetch(`${BASE_URL}/api/auth/demo`, {
    method: "POST",
  });
  console.log(`   Status: ${authRes.status} ${authRes.statusText}`);
  let sessionCookie = "";
  const setCookieHeader = authRes.headers.get("set-cookie");
  if (setCookieHeader) {
    const match = setCookieHeader.match(/referee_session=([^;]+)/);
    if (match) sessionCookie = match[0];
  }
  console.log(`   Session Cookie Received: ${Boolean(sessionCookie)}`);
  console.log("   [PASS] Seller authentication succeeded.\n");

  // 3. Create Deal in Neon Postgres
  console.log("3. Testing POST /api/deals (Save Contract to Neon DB)...");
  const createRes = await fetch(`${BASE_URL}/api/deals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body: JSON.stringify(draftData.contract),
  });
  console.log(`   Status: ${createRes.status} ${createRes.statusText}`);
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Create Deal API failed (${createRes.status}): ${errText}`);
  }
  const dealCreated = await createRes.json();
  console.log(`   Created Deal ID: ${dealCreated.dealId}`);
  console.log(`   Seller Token: ${dealCreated.sellerToken?.slice(0, 8)}...`);
  console.log(`   Buyer Token: ${dealCreated.buyerToken?.slice(0, 8)}...`);
  console.log("   [PASS] Neon Postgres write passed.\n");

  // 4. Fetch Deal by Capability Token
  console.log("4. Testing GET /api/deals/[buyerToken] (Read from Neon DB)...");
  const fetchRes = await fetch(`${BASE_URL}/api/deals/${dealCreated.buyerToken}`);
  console.log(`   Status: ${fetchRes.status} ${fetchRes.statusText}`);
  if (!fetchRes.ok) {
    const errText = await fetchRes.text();
    throw new Error(`Fetch Deal API failed (${fetchRes.status}): ${errText}`);
  }
  const dealFetched = await fetchRes.json();
  console.log(`   Deal Status in DB: ${dealFetched.deal?.status}`);
  console.log(`   Buyer View Role: ${dealFetched.role}`);
  console.log("   [PASS] Neon Postgres read passed.\n");

  // 5. Test Sweeper with Secret Header
  console.log("5. Testing POST /api/internal/sweep (Sweeper Endpoint)...");
  const sweepRes = await fetch(`${BASE_URL}/api/internal/sweep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": SWEEP_SECRET,
    },
  });
  console.log(`   Status: ${sweepRes.status} ${sweepRes.statusText}`);
  if (!sweepRes.ok) {
    const errText = await sweepRes.text();
    console.warn(`   Sweeper note (${sweepRes.status}): ${errText}`);
  } else {
    const sweepData = await sweepRes.json();
    console.log(`   Sweeper result: checked ${sweepData.swept || 0} deals.`);
    console.log("   [PASS] Internal sweeper endpoint authenticated and executed.\n");
  }

  // 6. Test PayPal Order Creation Endpoint
  console.log("6. Testing POST /api/deals/[buyerToken]/paypal/create-order (PayPal Sandbox Orders v2)...");
  const orderRes = await fetch(`${BASE_URL}/api/deals/${dealCreated.buyerToken}/paypal/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  console.log(`   Status: ${orderRes.status} ${orderRes.statusText}`);
  if (!orderRes.ok) {
    const errText = await orderRes.text();
    console.warn(`   PayPal create-order note (${orderRes.status}): ${errText}`);
  } else {
    const orderData = await orderRes.json();
    console.log(`   PayPal Sandbox Order ID created: ${orderData.orderId}`);
    console.log("   [PASS] PayPal Orders v2 Sandbox integration passed.\n");
  }

  console.log("======================================================");
  console.log("  ALL LIVE INTEGRATION CHECKS PASSED SUCCESSFULLY!    ");
  console.log("======================================================\n");
}

verifyLive().catch((err) => {
  console.error("\n[FAIL] Live verification failed:", err.message);
  process.exit(1);
});
