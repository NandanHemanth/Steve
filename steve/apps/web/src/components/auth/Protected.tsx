import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#f7f9fb] text-slate-900 p-8">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

