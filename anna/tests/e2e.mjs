// Browser smoke + visual E2E test for SmartAssistant Anna bundle (standalone mode).
// Usage: node tests/e2e.mjs
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(process.env.PUPPETEER_FROM || import.meta.url);
const puppeteer = require("puppeteer-core");
const bundle = fileURLToPath(new URL("../bundle/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  try {
    const p = req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0];
    const body = await readFile(join(bundle, p));
    res.writeHead(200, { "content-type": types[extname(p)] || "text/plain" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

const chrome = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const temp = await mkdtemp(join(tmpdir(), "smartassistant-e2e-"));
const page = await browser.newPage();
await page.setViewport({ width: 1040, height: 700 });

const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("CONSOLE_ERROR: " + msg.text());
});
page.on("dialog", (d) => d.accept());

const ok = (cond, msg) => {
  if (!cond) { errors.push("FAIL: " + msg); }
  else console.log("ok -", msg);
};
const text = () => page.$eval("#app", (e) => e.innerText);
const clickText = async (label) => {
  const clicked = await page.evaluate((lbl) => {
    const btns = [...document.querySelectorAll("button")].filter((b) => b.offsetParent !== null || b.closest("dialog[open]"));
    const target = btns.find((b) => b.textContent.trim() === lbl) || btns.find((b) => b.textContent.includes(lbl));
    if (!target) return false;
    target.click();
    return true;
  }, label);
  if (!clicked) throw new Error("no button " + label);
};
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("smartassistant:v1")));
const waitForRows = (kind, count) => page.waitForFunction((k, n) => {
  const s = JSON.parse(localStorage.getItem("smartassistant:v1"));
  return s?.[k]?.length === n;
}, {}, kind, count);
const waterTotal = (s) => s.water.reduce((n, row) => n + row.ml, 0);

const capture = async (name, width = 480, height = 860, extraOnly = false) => {
  if (process.env.UPDATE_SCREENSHOTS !== "1") return;
  await page.setViewport({ width, height });
  await page.evaluate(() => { document.getElementById("toast").hidden = true; window.scrollTo(0, 0); });
  await new Promise((r) => setTimeout(r, 180));
  if (!extraOnly) {
    await page.screenshot({ path: join(bundle, "..", "screenshots", `${name}.png`) });
  }
  if (process.env.SCREENSHOT_DIR) {
    await page.screenshot({ path: join(process.env.SCREENSHOT_DIR, `${name}.png`) });
  }
  await page.setViewport({ width: 390, height: 800 });
};

// 1. Stage 0 Welcome -> Stage 1 Setup Studio -> Live preview -> Submit
await page.goto(url);
await page.waitForSelector(".welcome-stage");
ok((await text()).includes("Master your daily runway"), "editorial welcome shown on first run");
await capture("welcome", 1040, 700);
await capture("desktop-welcome", 1040, 700, true);

await clickText("Set up my numbers");
await page.waitForSelector("form");
ok((await text()).includes("Set up in about a minute"), "setup studio opened on click");

await page.type("[name=budget]", "2000");
await page.type("[name=fixed]", "800");
await page.type("[name=weight]", "70");
await page.type("[name=height]", "170");
await page.type("[name=age]", "30");
await page.waitForFunction(() => document.body.innerText.includes("2000 kcal"));
ok(true, "setup studio live preview shows targets before submit");
await capture("onboarding", 1040, 700, true);

await page.setViewport({ width: 390, height: 800 });
await page.click("button[type=submit]");
await page.waitForSelector("nav.rail");
ok((await text()).includes("left to spend today"), "daily numbers shown after onboarding");

// 2. Hydration + 500ml race fix + Undo behavior
await clickText("+500 ml");
await waitForRows("water", 1);
ok(waterTotal(await stored()) === 500, "bottle adds 500 ml");
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("+500 ml"));
  for (let i = 0; i < 5; i++) button.click();
});
await waitForRows("water", 6);
ok(waterTotal(await stored()) === 3000, "rapid bottle taps each add 500 ml");
await clickText("+250 ml");
await waitForRows("water", 7);
ok(waterTotal(await stored()) === 3250, "glass adds 250 ml");
await page.click("#toast button");
await waitForRows("water", 6);
ok(waterTotal(await stored()) === 3000, "Undo removes the last water entry");
ok(await page.$eval("#toast", (e) => getComputedStyle(e).display === "none"), "Undo hides notification");

await clickText("+500 ml");
await waitForRows("water", 7);
const staleUndoHidden = await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("+250 ml"));
  button.click();
  return document.getElementById("toast").hidden;
});
ok(staleUndoHidden, "new water tap hides the previous Undo while saving");
await waitForRows("water", 8);
await page.waitForSelector("#toast:not([hidden]) button", { visible: true });
await page.click("#toast button");
await waitForRows("water", 7);
ok(waterTotal(await stored()) === 3500, "immediate Undo reverses the new glass only");

// 3. Smart Command Bar (EN + TR + live preview + single Undo)
await page.type("#quick-cmd", "tavuk pilav 180 tl 500ml su");
await page.waitForFunction(() => document.getElementById("quick-preview")?.innerText.includes("Chicken & Rice"));
ok(true, "Smart Command Bar previews EN/TR items live without reload");
await clickText("Log");
await waitForRows("expenses", 1);
await waitForRows("meals", 1);
await waitForRows("water", 8);
ok(waterTotal(await stored()) === 4000, "Smart Command Bar commits expense + meal + water atomically");
await page.click("#toast button");
await waitForRows("expenses", 0);
await waitForRows("meals", 0);
await waitForRows("water", 7);
ok(waterTotal(await stored()) === 3500, "Smart Command Bar Undo reverts all logged items");

// 4. Numeric input guards (Expense tab then Meal tab)
await page.type("#amt", "e-12.5");
ok(await page.$eval("#amt", (e) => e.value === "12.5"), "invalid amount characters blocked");
await clickText("Food");
await waitForRows("expenses", 1);

await clickText("Meal & Favorites");
const protein = 'input[aria-label="Protein grams"]';
await page.waitForSelector(protein);
await page.type(protein, "e-1");
ok(await page.$eval(protein, (e) => e.value === "1"), "invalid protein characters blocked");
const pasteBlocked = await page.$eval(protein, (e) => {
  const data = new DataTransfer();
  data.setData("text/plain", "1e3");
  const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data });
  e.dispatchEvent(event);
  return event.defaultPrevented;
});
ok(pasteBlocked, "invalid protein paste blocked");
await page.type('input[aria-label="Calories"]', "e-600");
ok(await page.$eval('input[aria-label="Calories"]', (e) => e.value === "600"), "invalid calories characters blocked");
await page.$eval(protein, (e) => { e.value = "1e3"; });
await clickText("Add Meal");
ok((await stored()).meals.length === 0, "invalid protein rejected on save");
await page.$eval(protein, (e) => { e.value = ""; e.dispatchEvent(new Event("input", { bubbles: true })); });
await clickText("Add Meal");
ok((await stored()).meals.length === 0, "empty protein rejected instead of recording zero");
await page.type(protein, "40");
await clickText("Add Meal");
await waitForRows("meals", 1);
await page.waitForFunction(() => document.body.innerText.includes("600 / "));
const todayText = await text();
ok(todayText.includes("3500 / "), "water total shown correctly");
ok(/600 \/ \d+/.test(todayText), "meal logged");

// 5. Dedicated Fasting Studio + 1s timer ticks without wiping Today input
await page.click('button[aria-label="Fasting"]');
await page.waitForSelector(".zone-list");
await clickText("18:6");
await clickText("Start 18h Fast");
await page.waitForSelector("[data-fasting-digits]");
await capture("fasting", 1040, 700);
await capture("desktop-fasting", 1040, 700, true);

await page.click('button[aria-label="Today"]');
await clickText("Expense");
await page.waitForSelector("#amt");
await page.type("#amt", "99");
const firstDigit = await page.$eval("[data-fasting-digits]", (e) => e.textContent);
let ticked = false;
try {
  await page.waitForFunction(
    (initial) => document.querySelector("[data-fasting-digits]")?.textContent !== initial,
    { timeout: 3500 },
    firstDigit,
  );
  ticked = true;
} catch {}
ok(ticked, "fasting timer ticks live every second");
ok(await page.$eval("#amt", (e) => e.value === "99"), "live fasting tick does not wipe typed form input");
await page.$eval("#amt", (e) => { e.value = ""; });

await capture("dashboard", 1040, 700);
await capture("desktop-today", 1040, 700, true);
await page.click('button[aria-label="Toggle color theme"]');
await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("smartassistant:v1"))?.theme === "light");
ok(true, "theme toggles cleanly and persists in state store");
await capture("desktop-light", 1040, 700, true);
await page.click('button[aria-label="Toggle color theme"]');
await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");

// 6. Insights view: SVG charts + weekly review insufficient -> ok + Share Card PNG
await page.click('button[aria-label="Insights"]');
await page.waitForSelector("svg.spend-chart");
await page.waitForSelector("svg.nutrition-chart");
await page.waitForSelector(".matrix-wrap");
ok(true, "7-day SVG charts and consistency matrix visible even before 3 days");
await clickText("Review my week");
await page.waitForFunction(() => document.body.innerText.includes("Only 1 of the last 7 days"));
ok(true, "review refuses to guess with 1 logged day");

// Seed 3 earlier days, reload, rerun review & test Share Card
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("smartassistant:v1"));
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  for (const n of [1, 2, 3]) {
    s.expenses.push({ id: "e" + n, date: day(n), amount: 90, category: "Eating out" });
    s.meals.push({ id: "m" + n, date: day(n), kcal: 2600, protein: 60 });
  }
  localStorage.setItem("smartassistant:v1", JSON.stringify(s));
});
await page.reload();
await page.waitForSelector("nav.rail");
await page.click('button[aria-label="Insights"]');
await clickText("Review my week");
await page.waitForFunction(() => document.body.innerText.includes("What to do next week"));
const reviewText = await text();
ok(/Week of /.test(reviewText) && /Protein averaged/.test(reviewText), "review returns specific actions");
await clickText("Download Share Card");
await page.waitForSelector('dialog#confirm-dialog[open] img.share-preview-img[src^="data:image/png"]');
ok(true, "PNG share card preview modal opens cleanly");
await clickText("Close");
await page.waitForFunction(() => !document.getElementById("confirm-dialog")?.open);
await capture("weekly-review", 1040, 700);
await capture("desktop-insights", 1040, 700, true);

// 7. Settings: backup validation, native <dialog> delete, offline wid guard, overflow checks
await page.click('button[aria-label="Settings"]');
ok((await text()).includes("Reviews completed: 1"), "local run counter incremented");
await capture("settings", 1040, 700);

const backup = await stored();
const invalidPath = join(temp, "invalid-backup.json");
await writeFile(invalidPath, JSON.stringify({ unrelated: true }), "utf8");
await (await page.$('input[type="file"]')).uploadFile(invalidPath);
await page.waitForFunction(() => document.getElementById("toast").textContent.includes("could not be restored"));
ok(JSON.stringify(await stored()) === JSON.stringify(backup), "unrelated JSON backup cannot erase existing data");

const backupPath = join(temp, "backup.json");
await writeFile(backupPath, JSON.stringify(backup), "utf8");
await page.click('button[aria-label="Today"]');
await clickText("+250 ml");
await waitForRows("water", 8);
await page.click('button[aria-label="Settings"]');
await (await page.$('input[type="file"]')).uploadFile(backupPath);
await waitForRows("water", 7);
ok(waterTotal(await stored()) === 3500, "backup restore replaces saved entries");

// Responsive horizontal overflow checks (390x800, 480x720, 1040x700)
for (const [w, h] of [[390, 800], [480, 720], [1040, 700]]) {
  await page.setViewport({ width: w, height: h });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok(!overflow, `no horizontal overflow at ${w}x${h}`);
}
await page.setViewport({ width: 390, height: 800 });

// Native <dialog> delete verification
await clickText("Delete all my data");
await page.waitForSelector("dialog#confirm-dialog[open]");
await clickText("Cancel");
await page.waitForFunction(() => !document.getElementById("confirm-dialog")?.open);
ok(!!(await stored()).profile, "delete cancellation preserves data");
await clickText("Delete all my data");
await page.waitForSelector("dialog#confirm-dialog[open]");
await page.evaluate(() => {
  window.__originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = () => { throw new Error("storage unavailable"); };
});
await clickText("Delete data");
await page.waitForFunction(() => document.querySelector('dialog#confirm-dialog[open] [role="alert"]')?.textContent.includes("storage unavailable"));
ok(!!(await stored()).profile, "failed delete preserves data and shows an error");
await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
await clickText("Delete data");
await page.waitForSelector(".welcome-stage");
ok((await stored()).profile === null, "delete clears persisted profile");
await page.reload();
await page.waitForSelector(".welcome-stage");
ok(true, "delete survives reload and returns to welcome stage");

// Anna host error isolation (?wid=...)
await page.goto(url + "?wid=test-window");
await page.waitForFunction(() => document.querySelector("#app")?.textContent.includes("Could not connect to Anna"));
ok(!(await page.$("form")), "host connection failure does not silently use local storage");

await browser.close();
server.close();
await rm(temp, { recursive: true, force: true });
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("e2e passed");
