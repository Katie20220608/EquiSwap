import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export const API_URL = "http://localhost:8001";
export const PASSWORD = "s3cret-pass";

export type TestUser = {
  name: string;
  email: string;
  token: string;
  userId: number;
};

let counter = 0;
export function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createUser(
  request: APIRequestContext,
  label = "user",
): Promise<TestUser> {
  const id = uniqueId(label);
  const name = `Parent ${id}`;
  const email = `${id}@example.com`;

  const registered = await request.post(`${API_URL}/auth/register`, {
    data: { name, email, password: PASSWORD },
  });
  expect(registered.ok()).toBeTruthy();

  const login = await request.post(`${API_URL}/auth/login`, {
    form: { username: email, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const { access_token: token } = await login.json();

  const me = await request.get(`${API_URL}/auth/me`, {
    headers: authHeaders(token),
  });
  const { user_id: userId } = await me.json();

  return { name, email, token, userId };
}

export async function createItem(
  request: APIRequestContext,
  user: TestUser,
  name: string,
): Promise<number> {
  const response = await request.post(`${API_URL}/items/`, {
    headers: authHeaders(user.token),
    data: { name, condition_score: 7, status: "available" },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).item_id;
}

export async function addToWishlist(
  request: APIRequestContext,
  user: TestUser,
  itemId: number,
): Promise<void> {
  const response = await request.post(`${API_URL}/wishlists/`, {
    headers: authHeaders(user.token),
    data: { item_id: itemId },
  });
  expect(response.status()).toBe(201);
}

// Creates `size` users who each own one item and wish for the next user's
// item, forming a single swap cycle.
export async function createSwapCycle(
  request: APIRequestContext,
  size: number,
) {
  const users: TestUser[] = [];
  const items: { id: number; name: string }[] = [];
  for (let i = 0; i < size; i += 1) {
    const user = await createUser(request, `cycle${i}`);
    const name = uniqueId(`Toy${i}`);
    users.push(user);
    items.push({ id: await createItem(request, user, name), name });
  }
  for (let i = 0; i < size; i += 1) {
    await addToWishlist(request, users[i], items[(i + 1) % size].id);
  }
  return { users, items };
}

// Signs in by storing the JWT the app reads on load, then opens the dashboard.
export async function openDashboardAs(page: Page, user: TestUser) {
  await page.goto("/");
  await page.evaluate((token) => {
    localStorage.setItem("equiswap_token", token);
  }, user.token);
  await page.goto("/dashboard");
  await expect(page.getByText(`Welcome back, ${user.name}.`)).toBeVisible();
}

export function panel(page: Page, headingId: string) {
  return page.locator(`section[aria-labelledby="${headingId}"]`);
}
