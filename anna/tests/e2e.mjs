// Browser smoke test for the bundle in standalone mode (no Anna host).
// Usage: node tests/e2e.mjs [bundleUrl]
// Needs puppeteer-core and a local Chrome (CHROME_PATH or the default install).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
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
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 800 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
const ok = (cond, msg) => { if (!cond) { errors.push("FAIL: " + msg); } else console.log("ok -", msg); };
const text = () => page.$eval("#app", (e) => e.innerText);
const clickText = async (label) => {
  const [h] = await page.$$(`xpath/.//button[normalize-space()="${label}"]`);
  if (!h) throw new Error("no button " + label);
  await h.click();
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

await clickText("+250 ml");
await page.type("#amt", "12.5");
await clickText("Food");
await page.type('input[aria-label="Calories"]', "600");
await page.type('input[aria-label="Protein grams"]', "40");
await clickText("Add");
const today = await text();
ok(today.includes("250 / "), "water logged in one tap");
ok(/600 \/ \d+/.test(today), "meal logged");

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
await clickText("Settings");
ok((await text()).includes("Reviews completed: 1"), "local run counter incremented");
await clickText("Delete all my data");
await page.waitForSelector("form");
ok(true, "delete returns to onboarding");

const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
ok(!overflow, "no horizontal overflow at 390px");

await browser.close();
server.close();
const bad = errors.filter((e) => e.startsWith("FAIL") || !e.startsWith("ok"));
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log("e2e passed");
