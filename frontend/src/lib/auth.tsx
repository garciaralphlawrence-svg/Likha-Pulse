import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../api";
import type { Me } from "../api/types";

interface AuthCtx { user: Me | null; ready: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void; can: (perm: string) => boolean }
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { api.me().then(setUser).finally(() => setReady(true)); }, []);
  const value: AuthCtx = {
    user, ready,
    login: async (e, p) => setUser(await api.login(e, p)),
    logout: () => { api.logout(); setUser(null); },
    can: (perm) => !!user?.permissions.includes(perm),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
