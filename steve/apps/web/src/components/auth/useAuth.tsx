import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "../../lib/firebase";

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  provider: "google" | "demo";
};

const DEMO_SESSION_KEY = "steve.demoSession";

function firebaseToAppUser(u: User): AppUser {
  return {
    id: u.uid,
    email: u.email ?? "unknown@local",
    displayName: u.displayName ?? "Student",
    provider: "google"
  };
}

function loadDemoUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppUser;
    if (!parsed?.id || parsed.provider !== "demo") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDemoUser(u: AppUser) {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(u));
}

function clearDemoUser() {
  localStorage.removeItem(DEMO_SESSION_KEY);
}

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  signInDemo: (username: string, password: string) => boolean;
  signOutAll: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  signInDemo: () => false,
  signOutAll: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(loadDemoUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setUser((u) => u ?? loadDemoUser());
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? firebaseToAppUser(u) : loadDemoUser());
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(() => {
    return {
      user,
      loading,
      signInDemo: (username: string, password: string) => {
        if (username !== "Steve123" || password !== "steve@2026") return false;
        const demo: AppUser = {
          id: "demo-steve",
          email: "demo@steve.local",
          displayName: "Demo Student",
          provider: "demo"
        };
        saveDemoUser(demo);
        setUser(demo);
        return true;
      },
      signOutAll: async () => {
        clearDemoUser();
        setUser(null);
        if (auth) {
          const { signOut } = await import("firebase/auth");
          await signOut(auth);
        }
      }
    };
  }, [user, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

