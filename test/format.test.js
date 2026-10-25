import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import process from "node:process";
import { addDays, fmtDate, todayStr } from "../src/lib/format.js";

test("Kampala business dates do not shift with the runtime timezone", () => {
  const instant = new Date("2026-01-01T22:30:00.000Z");
  assert.equal(todayStr(instant), "2026-01-02");
  assert.equal(addDays(2, instant), "2026-01-04");
  for (const timezone of ["Pacific/Honolulu", "America/Los_Angeles", "Asia/Tokyo"]) {
    const result = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import {todayStr} from './src/lib/format.js'; " +
          "process.stdout.write(todayStr(new Date('2026-01-01T22:30:00.000Z')))" ,
      ],
      { env: { ...process.env, TZ: timezone }, encoding: "utf8" },
    );
    assert.equal(result, "2026-01-02");
  }
});

test("date-only display uses the selected Kampala calendar day", () => {
  assert.equal(fmtDate("2026-01-01"), "Thu, 1 Jan");
});
