import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { ApiUser } from "./api";
import { clearToken, fetchCurrentUser, getToken, loginUser } from "./api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userState, setUserState] = useState<ApiUser | null | undefined>(() =>
    getToken() ? undefined : null,
  );
  const authGeneration = useRef(0);
  const user = userState ?? null;
  const isLoading = userState === undefined;

  const loadUser = useCallback(async (): Promise<ApiUser | null> => {
    if (!getToken()) {
      return null;
    }
    try {
      return await fetchCurrentUser();
    } catch {
      // Stored token is missing, expired, or invalid.
      clearToken();
      return null;
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;

    let cancelled = false;
    const generation = ++authGeneration.current;
    void loadUser().then((currentUser) => {
      if (!cancelled && generation === authGeneration.current) {
        setUserState(currentUser);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginUser({ email, password });
      const generation = ++authGeneration.current;
      const currentUser = await loadUser();
      if (generation === authGeneration.current) {
        setUserState(currentUser);
      }
    },
    [loadUser],
  );

  const logout = useCallback(() => {
    authGeneration.current += 1;
    clearToken();
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
