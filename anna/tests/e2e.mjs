// Browser smoke test for the bundle in standalone mode (no Anna host).
// Usage: node tests/e2e.mjs [bundleUrl]
// Needs puppeteer-core and a local Chrome (CHROME_PATH or the default install).
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(process.env.PUPPETEER_FROM || import.meta.url);
const puppeteer = require("puppeteer-core");
const bundle = fileURLToPath(new URL("../bundle/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

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
await page.setViewport({ width: 390, height: 800 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const ok = (cond, msg) => { if (!cond) { errors.push("FAIL: " + msg); } else console.log("ok -", msg); };
const text = () => page.$eval("#app", (e) => e.innerText);
const clickText = async (label) => {
  const [h] = await page.$$(`xpath/.//button[contains(normalize-space(), "${label}")]`);
  if (!h) throw new Error("no button " + label);
  await h.click();
};
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("smartassistant:v1")));
const waitForRows = (kind, count) => page.waitForFunction((k, n) => {
  const s = JSON.parse(localStorage.getItem("smartassistant:v1"));
  return s?.[k]?.length === n;
}, {}, kind, count);
const waterTotal = (s) => s.water.reduce((n, row) => n + row.ml, 0);
const capture = async (name) => {
  if (process.env.UPDATE_SCREENSHOTS !== "1") return;
  await page.setViewport({ width: 480, height: 900 });
  await page.evaluate(() => { document.getElementById("toast").hidden = true; window.scrollTo(0, 0); });
  await page.screenshot({ path: join(bundle, "..", "screenshots", `${name}.png`) });
  await page.setViewport({ width: 390, height: 800 });
};

await page.goto(url);
await page.waitForSelector("form");
ok((await text()).includes("Set up in about a minute"), "onboarding shown on first run");

await page.type("[name=budget]", "2000");
await page.type("[name=fixed]", "800");
await page.type("[name=weight]", "70");
await page.type("[name=height]", "170");
await page.type("[name=age]", "30");
await page.click("button[type=submit]");
await page.waitForSelector("nav.tabs");
ok((await text()).includes("left to spend today"), "daily numbers after onboarding");

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

const protein = 'input[aria-label="Protein grams"]';
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
await page.type("#amt", "12.5");
await clickText("Food");
await waitForRows("expenses", 1);
await page.type('input[aria-label="Calories"]', "600");
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
const today = await text();
ok(today.includes("3500 / "), "water total shown correctly");
ok(/600 \/ \d+/.test(today), "meal logged");
await capture("dashboard");

await clickText("Weekly review");
await clickText("Review my week");
await page.waitForFunction(() => document.body.innerText.includes("Only 1 of the last 7 days"));
ok(true, "review refuses to guess with 1 logged day");

// Seed three earlier days, reload, rerun.
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
await page.waitForSelector("nav.tabs");
await clickText("Weekly review");
await clickText("Review my week");
await page.waitForFunction(() => document.body.innerText.includes("What to do next week"));
const review = await text();
ok(/Week of /.test(review) && /Protein averaged/.test(review), "review returns specific actions");
await capture("weekly-review");
await clickText("Settings");
ok((await text()).includes("Reviews completed: 1"), "local run counter incremented");
await capture("settings");
const backup = await stored();
const backupPath = join(temp, "backup.json");
await writeFile(backupPath, JSON.stringify(backup), "utf8");
await clickText("Today");
await clickText("+250 ml");
await waitForRows("water", 8);
await clickText("Settings");
await (await page.$('input[type="file"]')).uploadFile(backupPath);
await waitForRows("water", 7);
ok(waterTotal(await stored()) === 3500, "backup restore replaces saved entries");
await clickText("Delete all my data");
await page.waitForSelector('[role="dialog"]');
await clickText("Cancel");
ok(!!(await stored()).profile, "delete cancellation preserves data");
await clickText("Delete all my data");
await page.evaluate(() => {
  window.__originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = () => { throw new Error("storage unavailable"); };
});
await clickText("Delete data");
await page.waitForFunction(() => document.querySelector('[role="dialog"] [role="alert"]')?.textContent.includes("storage unavailable"));
ok(!!(await stored()).profile, "failed delete preserves data and shows an error");
await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
await clickText("Delete data");
await page.waitForSelector("form");
ok((await stored()).profile === null, "delete clears persisted profile");
await page.reload();
await page.waitForSelector("form");
ok(true, "delete survives reload and returns to onboarding");

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
ok(!overflow, "no horizontal overflow at 390px");

await page.goto(url + "?wid=test-window");
await page.waitForFunction(() => document.querySelector("#app")?.textContent.includes("Could not connect to Anna"));
ok(!(await page.$("form")), "host connection failure does not silently use local storage");

await browser.close();
server.close();
await rm(temp, { recursive: true, force: true });
const bad = errors.filter((e) => e.startsWith("FAIL") || !e.startsWith("ok"));
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log("e2e passed");
