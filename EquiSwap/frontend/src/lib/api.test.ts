import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  checkHealth,
  changePassword,
  clearToken,
  createItem,
  createPreference,
  createWishlistEntry,
  deleteItem,
  deletePreference,
  deleteWishlistEntry,
  fetchCurrentUser,
  findSwapCycles,
  getToken,
  getUnreadNotificationCount,
  getUserTrustScore,
  listAdminUsers,
  listItems,
  listMyPreferences,
  listMySwapHistory,
  listMySwapProposals,
  listMyWishlist,
  listNotifications,
  listUserDirectory,
  listUsers,
  loginUser,
  markNotificationRead,
  proposeSwap,
  registerUser,
  resolveAssetUrl,
  respondToSwapProposal,
  setToken,
  updateItem,
  uploadItemImage,
} from "./api";

function mockFetchOnce(
  body: unknown,
  init: { ok: boolean; status?: number; statusText?: string } = { ok: true },
) {
  const response = {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 400),
    statusText: init.statusText ?? "",
    json: () => Promise.resolve(body),
  } as Response;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  return response;
}

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("token storage", () => {
    it("stores, reads, and clears the auth token", () => {
      expect(getToken()).toBeNull();
      setToken("abc123");
      expect(getToken()).toBe("abc123");
      clearToken();
      expect(getToken()).toBeNull();
    });
  });

  describe("registerUser", () => {
    it("posts the registration payload and returns the created user", async () => {
      const user = { user_id: 1, name: "Mia", email: "mia@example.com" };
      mockFetchOnce(user);

      const result = await registerUser({
        name: "Mia",
        email: "mia@example.com",
        password: "password1",
      });

      expect(result).toEqual(user);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/register"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws an ApiError with the server detail on failure", async () => {
      mockFetchOnce(
        { detail: "Email already registered" },
        { ok: false, status: 400 },
      );

      await expect(
        registerUser({
          name: "Mia",
          email: "mia@example.com",
          password: "password1",
        }),
      ).rejects.toMatchObject(new ApiError("Email already registered", 400));
    });
  });

  describe("loginUser", () => {
    it("logs in and persists the access token", async () => {
      mockFetchOnce({ access_token: "token-xyz", token_type: "bearer" });

      const token = await loginUser({
        email: "mia@example.com",
        password: "password1",
      });

      expect(token.access_token).toBe("token-xyz");
      expect(getToken()).toBe("token-xyz");
    });

    it("throws an ApiError when credentials are rejected", async () => {
      mockFetchOnce(
        { detail: "Incorrect email or password" },
        { ok: false, status: 401 },
      );

      await expect(
        loginUser({ email: "mia@example.com", password: "wrong" }),
      ).rejects.toMatchObject(new ApiError("Incorrect email or password", 401));
      expect(getToken()).toBeNull();
    });
  });

  describe("fetchCurrentUser", () => {
    it("sends the bearer token and returns the current user", async () => {
      setToken("token-xyz");
      const user = { user_id: 1, name: "Mia", email: "mia@example.com" };
      mockFetchOnce(user);

      const result = await fetchCurrentUser();

      expect(result).toEqual(user);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/me"),
        expect.objectContaining({
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });
  });

  describe("changePassword", () => {
    it("patches the password endpoint with the bearer token", async () => {
      setToken("token-xyz");
      mockFetchOnce(null, { ok: true, status: 204 });

      await expect(
        changePassword({
          currentPassword: "old-password",
          newPassword: "new-password",
        }),
      ).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/password"),
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-xyz",
          },
          body: JSON.stringify({
            current_password: "old-password",
            new_password: "new-password",
          }),
        }),
      );
    });
  });

  describe("checkHealth", () => {
    it("returns true when the health endpoint responds ok", async () => {
      mockFetchOnce({ status: "ok" });
      await expect(checkHealth()).resolves.toBe(true);
    });

    it("returns false when the request fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("network error")),
      );
      await expect(checkHealth()).resolves.toBe(false);
    });
  });

  describe("listItems", () => {
    it("returns the list of items", async () => {
      const items = [{ item_id: 1, name: "Desk lamp" }];
      mockFetchOnce(items);

      await expect(listItems()).resolves.toEqual(items);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/items/"),
        expect.objectContaining({ headers: {} }),
      );
    });
  });

  describe("listMyWishlist", () => {
    it("sends the bearer token and returns wishlist entries", async () => {
      setToken("token-xyz");
      const entries = [{ wishlist_id: 1, user_id: 1, item_id: 2 }];
      mockFetchOnce(entries);

      await expect(listMyWishlist()).resolves.toEqual(entries);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/wishlists/"),
        expect.objectContaining({
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });
  });

  describe("listMySwapProposals", () => {
    it("sends the bearer token and returns swap proposals", async () => {
      setToken("token-xyz");
      const proposals = [{ sp_id: 1, status: "pending" }];
      mockFetchOnce(proposals);

      await expect(listMySwapProposals()).resolves.toEqual(proposals);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/swaps/mine"),
        expect.objectContaining({
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });

    it("throws an ApiError when the request is unauthorized", async () => {
      mockFetchOnce(
        { detail: "Not authenticated" },
        { ok: false, status: 401 },
      );

      await expect(listMySwapProposals()).rejects.toMatchObject(
        new ApiError("Not authenticated", 401),
      );
    });
  });

  describe("createItem", () => {
    it("posts the item payload and returns the created item", async () => {
      setToken("token-xyz");
      const item = { item_id: 1, name: "Desk lamp", status: "available" };
      mockFetchOnce(item, { ok: true, status: 201 });

      const result = await createItem({ name: "Desk lamp" });

      expect(result).toEqual(item);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/items/"),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token-xyz",
          },
        }),
      );
    });

    it("throws an ApiError when creation fails", async () => {
      mockFetchOnce(
        { detail: "Invalid category_id: category does not exist" },
        { ok: false, status: 422 },
      );

      await expect(createItem({ name: "Desk lamp" })).rejects.toMatchObject(
        new ApiError("Invalid category_id: category does not exist", 422),
      );
    });
  });

  describe("updateItem", () => {
    it("puts the item payload and returns the updated item", async () => {
      const item = { item_id: 1, name: "Brass lamp", status: "available" };
      mockFetchOnce(item);

      const result = await updateItem(1, { name: "Brass lamp" });

      expect(result).toEqual(item);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/items/1"),
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  describe("deleteItem", () => {
    it("deletes an item using the bearer token", async () => {
      setToken("token-xyz");
      mockFetchOnce(null, { ok: true, status: 204 });

      await expect(deleteItem(1)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/items/1"),
        expect.objectContaining({
          method: "DELETE",
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });
  });

  describe("createWishlistEntry", () => {
    it("posts the item_id and returns the wishlist entry", async () => {
      const entry = { wishlist_id: 1, user_id: 1, item_id: 2 };
      mockFetchOnce(entry, { ok: true, status: 201 });

      const result = await createWishlistEntry(2);

      expect(result).toEqual(entry);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/wishlists/"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ item_id: 2 }),
        }),
      );
    });

    it("throws an ApiError when the item is already wishlisted", async () => {
      mockFetchOnce(
        { detail: "Item already in wishlist" },
        { ok: false, status: 400 },
      );

      await expect(createWishlistEntry(2)).rejects.toMatchObject(
        new ApiError("Item already in wishlist", 400),
      );
    });
  });

  describe("deleteWishlistEntry", () => {
    it("deletes a wishlist entry using the bearer token", async () => {
      setToken("token-xyz");
      mockFetchOnce(null, { ok: true, status: 204 });

      await expect(deleteWishlistEntry(1)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/wishlists/1"),
        expect.objectContaining({
          method: "DELETE",
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });
  });

  describe("notifications", () => {
    it("lists notifications for the current user", async () => {
      setToken("token-xyz");
      const notifications = [
        {
          n_id: 1,
          user_id: 1,
          type: "swap_proposal",
          message: "New swap request",
          is_read: false,
        },
      ];
      mockFetchOnce(notifications);

      await expect(listNotifications()).resolves.toEqual(notifications);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/"),
        expect.objectContaining({
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });

    it("returns the unread notification count", async () => {
      setToken("token-xyz");
      mockFetchOnce({ unread_count: 2 });

      await expect(getUnreadNotificationCount()).resolves.toBe(2);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/unread-count"),
        expect.objectContaining({
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });

    it("marks a notification as read", async () => {
      setToken("token-xyz");
      const notification = {
        n_id: 1,
        user_id: 1,
        type: "swap_completed",
        message: "Swap completed",
        is_read: true,
      };
      mockFetchOnce(notification);

      await expect(markNotificationRead(1)).resolves.toEqual(notification);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/1/read"),
        expect.objectContaining({
          method: "PATCH",
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });
  });

  describe("listMySwapHistory", () => {
    it("returns the swap history", async () => {
      const history = [{ sh_id: 1, item_id: 1 }];
      mockFetchOnce(history);

      await expect(listMySwapHistory()).resolves.toEqual(history);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/swaps/history"),
        expect.anything(),
      );
    });
  });

  describe("findSwapCycles", () => {
    it("returns swap cycles for a user", async () => {
      const cycles = { user_id: 1, cycles: [[1, 2]] };
      mockFetchOnce(cycles);

      await expect(findSwapCycles(1)).resolves.toEqual(cycles);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/swaps/find/1"),
        expect.anything(),
      );
    });
  });

  describe("proposeSwap", () => {
    it("posts the proposed user cycle", async () => {
      const proposals = [{ sp_id: 1, status: "pending" }];
      mockFetchOnce(proposals, { ok: true, status: 201 });

      await expect(proposeSwap([1, 2])).resolves.toEqual(proposals);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/swaps/propose"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ user_ids: [1, 2] }),
        }),
      );
    });
  });

  describe("respondToSwapProposal", () => {
    it("patches the swap decision with a rejection reason", async () => {
      const proposal = { sp_id: 1, status: "rejected" };
      mockFetchOnce(proposal);

      await expect(
        respondToSwapProposal(1, "rejected", "Changed my mind"),
      ).resolves.toEqual(proposal);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/swaps/1/respond"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            decision: "rejected",
            rejection_reason: "Changed my mind",
          }),
        }),
      );
    });
  });

  describe("listUsers", () => {
    it("returns all users", async () => {
      const users = [{ user_id: 1, name: "Mia" }];
      mockFetchOnce(users);

      await expect(listUsers()).resolves.toEqual(users);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/users/"),
        expect.anything(),
      );
    });
  });

  describe("listUserDirectory", () => {
    it("returns the user directory", async () => {
      const users = [{ user_id: 1, name: "Mia" }];
      mockFetchOnce(users);

      await expect(listUserDirectory()).resolves.toEqual(users);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/users/directory"),
        expect.anything(),
      );
    });
  });

  describe("preferences", () => {
    it("lists the current user's preferences", async () => {
      const preferences = [
        {
          uf_id: 1,
          user_id: 1,
          avoid_user_id: 2,
          avoid_user_name: "Noah",
          reason: null,
          created_at: null,
        },
      ];
      mockFetchOnce(preferences);

      await expect(listMyPreferences()).resolves.toEqual(preferences);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/preferences/"),
        expect.anything(),
      );
    });

    it("creates a preference with a reason", async () => {
      const preference = {
        uf_id: 1,
        user_id: 1,
        avoid_user_id: 2,
        avoid_user_name: "Noah",
        reason: "Missed a swap",
        created_at: null,
      };
      mockFetchOnce(preference, { ok: true, status: 201 });

      await expect(createPreference(2, "Missed a swap")).resolves.toEqual(
        preference,
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/preferences/"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            avoid_user_id: 2,
            reason: "Missed a swap",
          }),
        }),
      );
    });

    it("deletes a preference", async () => {
      mockFetchOnce(null, { ok: true, status: 204 });

      await expect(deletePreference(1)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/preferences/1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("listAdminUsers", () => {
    it("returns admin users with their items", async () => {
      const users = [{ user_id: 1, name: "Mia", items: [] }];
      mockFetchOnce(users);

      await expect(listAdminUsers()).resolves.toEqual(users);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/users"),
        expect.anything(),
      );
    });
  });

  describe("getUserTrustScore", () => {
    it("returns the trust score and history for a user", async () => {
      const trust = {
        user_id: 1,
        trust_score: 80,
        rejection_count: 0,
        history: [],
      };
      mockFetchOnce(trust);

      await expect(getUserTrustScore(1)).resolves.toEqual(trust);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/users/1/trust"),
        expect.anything(),
      );
    });
  });

  describe("uploadItemImage", () => {
    it("uploads the file and returns its url", async () => {
      setToken("token-xyz");
      mockFetchOnce({ url: "/uploads/lamp.jpg" }, { ok: true, status: 201 });
      const file = new File(["data"], "lamp.jpg", { type: "image/jpeg" });

      await expect(uploadItemImage(file)).resolves.toEqual({
        url: "/uploads/lamp.jpg",
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/items/upload-image"),
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: "Bearer token-xyz" },
        }),
      );
    });

    it("throws an ApiError when the upload fails", async () => {
      mockFetchOnce(
        { detail: "Unsupported file type" },
        { ok: false, status: 415 },
      );
      const file = new File(["data"], "lamp.txt", { type: "text/plain" });

      await expect(uploadItemImage(file)).rejects.toMatchObject(
        new ApiError("Unsupported file type", 415),
      );
    });
  });

  describe("resolveAssetUrl", () => {
    it("returns null for empty or missing paths", () => {
      expect(resolveAssetUrl(null)).toBeNull();
      expect(resolveAssetUrl(undefined)).toBeNull();
      expect(resolveAssetUrl("   ")).toBeNull();
    });

    it("returns absolute http(s) urls unchanged", () => {
      expect(resolveAssetUrl("https://cdn.example.com/a.jpg")).toBe(
        "https://cdn.example.com/a.jpg",
      );
    });

    it("adds https to protocol-relative urls", () => {
      expect(resolveAssetUrl("//cdn.example.com/a.jpg")).toBe(
        "https://cdn.example.com/a.jpg",
      );
    });

    it("returns data urls unchanged", () => {
      expect(resolveAssetUrl("data:image/png;base64,abc")).toBe(
        "data:image/png;base64,abc",
      );
    });

    it("adds https to bare domain-like paths", () => {
      expect(resolveAssetUrl("example.com/a.jpg")).toBe(
        "https://example.com/a.jpg",
      );
    });

    it("prefixes leading-slash paths with the API base url", () => {
      expect(resolveAssetUrl("/uploads/a.jpg")).toBe(
        "http://localhost:8000/uploads/a.jpg",
      );
    });

    it("prefixes bare relative paths with the API base url", () => {
      expect(resolveAssetUrl("uploads/a.jpg")).toBe(
        "http://localhost:8000/uploads/a.jpg",
      );
    });
  });
});
