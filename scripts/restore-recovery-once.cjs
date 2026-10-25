const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const recoveryDir =
  "C:/Users/HP/Documents/Solo Sales OS Recovery/" +
  "client-app-recovery-20261023-224511";
const source = fs.readFileSync(path.resolve("src/App.jsx"), "utf8");
const url = source.match(/DEFAULT_SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const key = source.match(/DEFAULT_SUPABASE_KEY\s*=\s*"([^"]+)"/)?.[1];
if (!url || !key) throw new Error("Configured cloud endpoint not found");

const readOnlyRows = JSON.parse(
  fs.readFileSync(path.join(recoveryDir, "cloud-readonly.json"), "utf8"),
);
const preservedCloudRow = Array.isArray(readOnlyRows)
  ? readOnlyRows[0]
  : readOnlyRows;
const candidate = JSON.parse(
  fs.readFileSync(
    path.join(recoveryDir, "restore-payload-20261023T200708Z.json"),
    "utf8",
  ),
);
const stable = (value) =>
  JSON.stringify(value, (keyName, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((name) => [name, item[name]]),
        )
      : item,
  );
const digest = (value) =>
  crypto.createHash("sha256").update(stable(value)).digest("hex");
const endpoint = `${url}/rest/v1/sales_os_state`;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function readPrimary() {
  const response = await fetch(
    `${endpoint}?id=eq.primary&select=id,updated_at,payload`,
    { headers, signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) throw new Error(`Read failed with HTTP ${response.status}`);
  return response.json();
}

async function restore() {
  const before = await readPrimary();
  if (
    before.length !== 1 ||
    before[0].updated_at !== preservedCloudRow.updated_at ||
    digest(before[0].payload) !== digest(preservedCloudRow.payload)
  ) {
    throw new Error("Cloud row differs from the preserved read-only copy; refusing overwrite");
  }

  const params = new URLSearchParams({
    id: "eq.primary",
    updated_at: `eq.${preservedCloudRow.updated_at}`,
    select: "id,updated_at,payload",
  });
  const response = await fetch(`${endpoint}?${params}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      payload: candidate,
      updated_at: candidate.meta.updatedAt,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Conditional restore failed with HTTP ${response.status}`);
  }
  const patched = await response.json();
  if (
    patched.length !== 1 ||
    digest(patched[0].payload) !== digest(candidate) ||
    patched[0].updated_at !== candidate.meta.updatedAt
  ) {
    throw new Error("Restore response did not match the recovery candidate");
  }

  const after = await readPrimary();
  if (
    after.length !== 1 ||
    digest(after[0].payload) !== digest(candidate) ||
    after[0].updated_at !== candidate.meta.updatedAt
  ) {
    throw new Error("Cloud read-back mismatch");
  }
  const clients = Object.values(after[0].payload.clients || {}).flat();
  console.log(
    JSON.stringify({
      status: "restored-and-read-back-verified",
      rowId: after[0].id,
      updatedAt: after[0].updated_at,
      payloadSha256: digest(after[0].payload),
      counts: {
        clients: clients.length,
        services: clients.reduce((sum, client) => sum + (client.services || []).length, 0),
        payments: clients.reduce((sum, client) => sum + (client.payments || []).length, 0),
        expenses: after[0].payload.expenses.length,
        separatelyLoggedIncome: after[0].payload.finance.manualIncome.length,
        outreachLogs: after[0].payload.outreach.logs.length,
      },
      replacedOnlyIfPriorTimestampMatched: preservedCloudRow.updated_at,
    }),
  );
}

restore().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
