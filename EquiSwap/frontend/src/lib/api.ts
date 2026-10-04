const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type ApiUser = {
  user_id: number;
  name: string;
  email: string;
  trust_score: number;
  rejection_count: number;
  role: string;
  is_active: boolean;
};

export type AuthToken = {
  access_token: string;
  token_type: string;
};

export const AGE_GROUPS = ["0-2", "3-5", "6-8", "9-12", "13+"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export type ApiItem = {
  item_id: number;
  owner_id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  condition_score: number;
  age_group?: AgeGroup | null;
  status: string;
  image_url: string | null;
};

export type ApiWishlistEntry = {
  wishlist_id: number;
  user_id: number;
  item_id: number;
};

export type ItemInput = {
  name: string;
  description?: string | null;
  category_id?: number | null;
  condition_score?: number;
  age_group?: AgeGroup | null;
  image_url?: string | null;
};

export type ApiSwapProposal = {
  sp_id: number;
  cycle_id: string;
  giver_id: number;
  receiver_id: number;
  item_id: number;
  status: string;
  expires_at: string | null;
  responded_at?: string | null;
  rejection_reason?: string | null;
};

export type ApiSwapMessage = {
  message_id: number;
  cycle_id: string;
  sender_id: number;
  sender_name: string;
  message: string;
  created_at: string | null;
};

export type ApiTrustLog = {
  tl_id: number;
  user_id: number;
  action: string;
  score_change: number;
  logged_at: string | null;
  description: string | null;
};

export type ApiTrustScore = {
  user_id: number;
  trust_score: number;
  rejection_count: number;
  history: ApiTrustLog[];
};

export type ApiSwapHistory = {
  sh_id: number;
  item_id: number;
  from_user_id: number;
  to_user_id: number;
  cycle_id: string | null;
  swap_date: string | null;
  notes: string | null;
};

export type ApiNotification = {
  n_id: number;
  user_id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at?: string | null;
  related_cycle_id?: string | null;
};

export type ApiSwapCycles = {
  user_id: number;
  cycles: number[][];
  cycle_item_ids?: (number | null)[][];
};

export type ApiAdminUser = ApiUser & {
  items: ApiItem[];
};

export type ApiDailyCount = { day: string; count: number };

export type ApiAdminStats = {
  total_users: number;
  new_users_7d: number;
  total_items: number;
  available_items: number;
  open_swaps: number;
  completed_swaps: number;
  proposal_status_counts: Record<string, number>;
  signups_per_day: ApiDailyCount[];
  swaps_per_day: ApiDailyCount[];
  top_categories: { category: string; items: number; wishlists: number }[];
};

export type ApiPreference = {
  uf_id: number;
  user_id: number;
  avoid_user_id: number;
  avoid_user_name: string | null;
  reason: string | null;
  created_at: string | null;
};

export type ApiUserDirectoryEntry = {
  user_id: number;
  name: string;
};

export type SwapDecision = "accepted" | "rejected";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") {
      return body.detail;
    }
  } catch {
    // Response had no JSON body; fall back to the status text below.
  }
  return response.statusText || "Request failed";
}

export function getToken(): string | null {
  return localStorage.getItem("equiswap_token");
}

export function setToken(token: string): void {
  localStorage.setItem("equiswap_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("equiswap_token");
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ApiUser> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }

  return response.json();
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthToken> {
  const body = new URLSearchParams({
    username: input.email,
    password: input.password,
  });

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }

  const token: AuthToken = await response.json();
  setToken(token.access_token);
  return token;
}

export async function fetchCurrentUser(): Promise<ApiUser> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }

  return response.json();
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      current_password: input.currentPassword,
      new_password: input.newPassword,
    }),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function authedGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }

  return response.json();
}

async function authedJson<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH",
  body: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }

  return response.json();
}

async function authedDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }
}

export function listItems(): Promise<ApiItem[]> {
  return authedGet<ApiItem[]>("/items/");
}

export function listMyWishlist(): Promise<ApiWishlistEntry[]> {
  return authedGet<ApiWishlistEntry[]>("/wishlists/");
}

export function listMySwapProposals(): Promise<ApiSwapProposal[]> {
  return authedGet<ApiSwapProposal[]>("/swaps/mine");
}

export function listMySwapHistory(): Promise<ApiSwapHistory[]> {
  return authedGet<ApiSwapHistory[]>("/swaps/history");
}

export function listNotifications(
  unreadOnly = false,
): Promise<ApiNotification[]> {
  const query = unreadOnly ? "?unread_only=true" : "";
  return authedGet<ApiNotification[]>(`/notifications/${query}`);
}

export function getUnreadNotificationCount(): Promise<number> {
  return authedGet<{ unread_count: number }>(
    "/notifications/unread-count",
  ).then((body) => body.unread_count);
}

export async function markNotificationRead(
  notificationId: number,
): Promise<ApiNotification> {
  const response = await fetch(
    `${API_BASE_URL}/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers: authHeaders(),
    },
  );

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }

  return response.json();
}

export function findSwapCycles(userId: number): Promise<ApiSwapCycles> {
  return authedGet<ApiSwapCycles>(`/swaps/find/${userId}`);
}

export function proposeSwap(userIds: number[]): Promise<ApiSwapProposal[]> {
  return authedJson<ApiSwapProposal[]>("/swaps/propose", "POST", {
    user_ids: userIds,
  });
}

export function respondToSwapProposal(
  spId: number,
  decision: SwapDecision,
  rejectionReason?: string,
): Promise<ApiSwapProposal> {
  return authedJson<ApiSwapProposal>(`/swaps/${spId}/respond`, "PATCH", {
    decision,
    rejection_reason: rejectionReason ?? null,
  });
}

export function listSwapMessages(cycleId: string): Promise<ApiSwapMessage[]> {
  return authedGet<ApiSwapMessage[]>(`/messages/cycles/${cycleId}`);
}

export function sendSwapMessage(
  cycleId: string,
  message: string,
): Promise<ApiSwapMessage> {
  return authedJson<ApiSwapMessage>(`/messages/cycles/${cycleId}`, "POST", {
    message,
  });
}

export function listUsers(): Promise<ApiUser[]> {
  return authedGet<ApiUser[]>("/users/");
}

export function listUserDirectory(): Promise<ApiUserDirectoryEntry[]> {
  return authedGet<ApiUserDirectoryEntry[]>("/users/directory");
}

export function listMyPreferences(): Promise<ApiPreference[]> {
  return authedGet<ApiPreference[]>("/preferences/");
}

export function createPreference(
  avoidUserId: number,
  reason?: string,
): Promise<ApiPreference> {
  return authedJson<ApiPreference>("/preferences/", "POST", {
    avoid_user_id: avoidUserId,
    reason: reason ?? null,
  });
}

export function deletePreference(ufId: number): Promise<void> {
  return authedDelete(`/preferences/${ufId}`);
}

export type AdminUserFilters = {
  q?: string;
  role?: string;
  status?: "active" | "suspended";
};

export function listAdminUsers(
  filters: AdminUserFilters = {},
): Promise<ApiAdminUser[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  const query = params.toString();
  return authedGet<ApiAdminUser[]>(
    query ? `/admin/users?${query}` : "/admin/users",
  );
}

export type ApiAdminUserDetail = {
  user: ApiUser;
  items: ApiItem[];
  swap_counts: {
    given: number;
    received: number;
    completed: number;
    rejected: number;
  };
  wishlist_count: number;
  recent_trust_logs: ApiTrustLog[];
};

export function getAdminUserDetail(
  userId: number,
): Promise<ApiAdminUserDetail> {
  return authedGet<ApiAdminUserDetail>(`/admin/users/${userId}`);
}

export function setAdminUserStatus(
  userId: number,
  isActive: boolean,
): Promise<ApiUser> {
  return authedJson<ApiUser>(`/admin/users/${userId}/status`, "PATCH", {
    is_active: isActive,
  });
}

export type ApiAdminSwapInsights = {
  total_cycles: number;
  completed_cycles: number;
  success_rate: number;
  average_cycle_length: number;
  average_hours_to_complete: number | null;
  outcome_counts: Record<string, number>;
  by_length: {
    length: number;
    total: number;
    completed: number;
    success_rate: number;
  }[];
  top_rejection_reasons: { reason: string; count: number }[];
  stale_pending_cycles: number;
};

export function getAdminSwapInsights(): Promise<ApiAdminSwapInsights> {
  return authedGet<ApiAdminSwapInsights>("/admin/swap-insights");
}

export function getAdminStats(): Promise<ApiAdminStats> {
  return authedGet<ApiAdminStats>("/admin/stats");
}

export function getUserTrustScore(userId: number): Promise<ApiTrustScore> {
  return authedGet<ApiTrustScore>(`/users/${userId}/trust`);
}

export function createItem(input: ItemInput): Promise<ApiItem> {
  return authedJson<ApiItem>("/items/", "POST", input);
}

export function updateItem(
  itemId: number,
  input: Partial<ItemInput>,
): Promise<ApiItem> {
  return authedJson<ApiItem>(`/items/${itemId}`, "PUT", input);
}

export function deleteItem(itemId: number): Promise<void> {
  return authedDelete(`/items/${itemId}`);
}

export function createWishlistEntry(itemId: number): Promise<ApiWishlistEntry> {
  return authedJson<ApiWishlistEntry>("/wishlists/", "POST", {
    item_id: itemId,
  });
}

export function deleteWishlistEntry(wishlistId: number): Promise<void> {
  return authedDelete(`/wishlists/${wishlistId}`);
}

export async function uploadItemImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/items/upload-image`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }

  return response.json();
}

export function resolveAssetUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  if (/^data:/i.test(trimmed)) return trimmed;
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?#]|$)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  if (trimmed.startsWith("/")) return `${API_BASE_URL}${trimmed}`;
  return `${API_BASE_URL}/${trimmed}`;
}
