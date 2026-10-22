import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve("src");
const files = [];
const failures = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(target);
    } else if (/\.(jsx?|css)$/.test(entry.name)) {
      files.push(target);
    }
  }
}

await collect(sourceRoot);

const required = [
  "views/TodayView.jsx",
  "views/OutreachView.jsx",
  "views/DueView.jsx",
  "views/OngoingView.jsx",
  "views/HistoryView.jsx",
  "views/StatsView.jsx",
  "views/PlaybookView.jsx",
  "views/MoreView.jsx",
  "clients/ClientRow.jsx",
  "clients/ClientScreen.jsx",
  "clients/ClientForm.jsx",
  "money/MoneyView.jsx",
  "money/Overview.jsx",
  "money/Transactions.jsx",
  "money/Purposes.jsx",
  "money/Accounts.jsx",
  "money/ClientBalances.jsx",
  "settings/BusinessProfile.jsx",
  "settings/CloudSync.jsx",
  "SearchPanel.jsx",
  "QuickAdd.jsx",
  "PrintDialog.jsx",
];

for (const relative of required) {
  const fullPath = path.join(sourceRoot, relative);
  try {
    const content = await readFile(fullPath, "utf8");
    if (!/from\s+["'][^"']*components(?:\/[^"']*)?["']/.test(content)) {
      failures.push(`${relative}: missing import from src/components`);
    }
  } catch {
    failures.push(`${relative}: required screen module is missing`);
  }
}

const emoji = /\p{Extended_Pictographic}/u;
const legacyPalette = /aaff00|080808/i;
const hexColor = /#[0-9a-fA-F]{3,8}\b/;
const unsafeDialog = /\b(?:confirm|prompt|alert)\s*\(/;
const smallFont = /fontSize\s*:\s*(\d+(?:\.\d+)?)\s*(?:,|})/g;
const uppercaseTransform = /text-transform\s*:\s*uppercase/i;

for (const file of files) {
  const relative = path.relative(sourceRoot, file).replaceAll("\\", "/");
  if (relative === "documents.js" || relative === "styles/theme.css") continue;

  const content = await readFile(file, "utf8");
  if (hexColor.test(content)) failures.push(`${relative}: hex colour literal found`);
  if (legacyPalette.test(content)) failures.push(`${relative}: old palette literal found`);
  if (emoji.test(content)) failures.push(`${relative}: emoji character found`);
  if (unsafeDialog.test(content)) failures.push(`${relative}: native confirm/prompt/alert call found`);
  if (uppercaseTransform.test(content) && !relative.endsWith("ui.css")) {
    failures.push(`${relative}: uppercase transform outside shared label styles`);
  }

  if (/View\.jsx$/.test(relative)) {
    const inlineStyles = content.match(/style=\{\{/g) || [];
    if (inlineStyles.length > 3) {
      failures.push(`${relative}: ${inlineStyles.length} inline style objects (maximum 3)`);
    }
  }

  for (const match of content.matchAll(smallFont)) {
    if (Number(match[1]) < 12) {
      failures.push(`${relative}: inline font size below 12px`);
      break;
    }
  }
}

if (failures.length) {
  console.error(`UI coverage failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("UI coverage checks passed.");
}
