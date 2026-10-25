const crypto = require("node:crypto");
const fs = require("node:fs");
const source = fs.readFileSync("src/App.jsx", "utf8");
const url = source.match(/DEFAULT_SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const key = source.match(/DEFAULT_SUPABASE_KEY\s*=\s*"([^"]+)"/)?.[1];
if (!url || !key) throw new Error("Configured cloud endpoint unavailable");

async function main() {
  const response = await fetch(
    `${url}/rest/v1/sales_os_state?id=eq.primary&select=id,updated_at,payload`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error(`Read failed with HTTP ${response.status}`);
  const rows = await response.json();
  const row = rows[0];
  const data = row?.payload || {};
  const clients = Object.values(data.clients || {}).flat();
  const digest = crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
  console.log(JSON.stringify({
    rows: rows.length,
    id: row?.id,
    updatedAt: row?.updated_at,
    payloadUpdatedAt: data.meta?.updatedAt,
    sha256: digest,
    counts: {
      clients: clients.length,
      services: clients.reduce((sum, client) => sum + (client.services || []).length, 0),
      payments: clients.reduce((sum, client) => sum + (client.payments || []).length, 0),
      expenses: (data.expenses || []).length,
      separatelyLoggedIncome: (data.finance?.manualIncome || []).length,
      outreachLogs: (data.outreach?.logs || []).length,
    },
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
