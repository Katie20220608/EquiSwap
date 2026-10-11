// Captures the screenshots used by the GitHub Pages guide in /docs.
// Requires the backend (port 8001) and frontend (port 4174) to be running, see docs/README.
import { chromium } from "@playwright/test";

const API = "http://localhost:8001";
const APP = "http://localhost:4174";
const OUT = new URL("../../../docs/images/", import.meta.url).pathname;
const PASSWORD = "s3cret-pass";
const stamp = Date.now().toString(36);

async function api(path, { token, json, form } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let body;
  if (json) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  if (form) { body = new URLSearchParams(form); }
  const r = await fetch(API + path, { method: body ? "POST" : "GET", headers, body });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  return r.json();
}

async function makeUser(name) {
  const email = `${name.toLowerCase()}-${stamp}@example.com`;
  await api("/auth/register", { json: { name, email, password: PASSWORD } });
  const { access_token: token } = await api("/auth/login", { form: { username: email, password: PASSWORD } });
  return { name, email, token };
}

const names = ["Alice", "Ben", "Chloe"];
const toys = ["Wooden Train Set", "Picture Book Bundle", "Building Blocks"];
const users = [];
const itemIds = [];
for (let i = 0; i < 3; i++) {
  const u = await makeUser(names[i]);
  users.push(u);
  const item = await api("/items/", { token: u.token, json: { name: toys[i], condition_score: 8, status: "available" } });
  itemIds.push(item.item_id);
}
for (let i = 0; i < 3; i++) {
  await api("/wishlists/", { token: users[i].token, json: { item_id: itemIds[(i + 1) % 3] } });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}${name}.png`, ...opts });
const panel = (id) => page.locator(`section[aria-labelledby="${id}"]`);

await page.goto(`${APP}/register`);
await page.getByLabel("Name").fill("Alice");
await page.getByLabel("Email").fill(users[0].email.replace("alice", "alice2"));
await page.locator("#register-password").fill(PASSWORD);
await page.locator("#register-confirm-password").fill(PASSWORD);
await shot("01-register");

await page.goto(`${APP}/login`);
await page.getByLabel("Email").fill(users[0].email);
await page.locator("#login-password").fill(PASSWORD);
await shot("02-login");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(/dashboard/);
await page.getByText(`Welcome back, Alice.`).waitFor();
await page.waitForTimeout(800);
await shot("03-dashboard", { fullPage: true });
await panel("my-items-heading").screenshot({ path: `${OUT}04-my-items.png` });
await panel("matches-heading").screenshot({ path: `${OUT}05-matches.png` });

await panel("matches-heading").getByRole("button", { name: "Propose swap" }).click();
await page.waitForTimeout(1000);
await page.reload();
await page.getByText(`Welcome back, Alice.`).waitFor();
await panel("status-heading").screenshot({ path: `${OUT}06-status.png` });

async function accept(user, item) {
  await page.evaluate((t) => localStorage.setItem("equiswap_token", t), user.token);
  await page.goto(`${APP}/dashboard`);
  await page.getByText(`Welcome back, ${user.name}.`).waitFor();
  await panel("status-heading").locator("li", { hasText: `${item} · giving` }).getByRole("button", { name: "Accept" }).click();
  await page.waitForTimeout(800);
}
await accept(users[0], toys[0]);
await shot("07-accepted-chat", { fullPage: true });
await accept(users[1], toys[1]);
await accept(users[2], toys[2]);

await page.evaluate((t) => localStorage.setItem("equiswap_token", t), users[0].token);
await page.goto(`${APP}/dashboard`);
await page.getByText("Welcome back, Alice.").waitFor();
await page.waitForTimeout(800);
await panel("history-heading").screenshot({ path: `${OUT}08-history.png` });
await browser.close();
