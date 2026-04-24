"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/hooks/useAuthStore";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setToken, fetchUser } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setToken(token);
      fetchUser().then(() => {
        router.push("/");
      }).catch((err) => {
        console.error("Failed to fetch user:", err);
        router.push("/");
      });
    } else {
      router.push("/");
    }
  }, [searchParams, router, setToken, fetchUser]);

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
      <Loader2 size={48} style={{ animation: "spin 1s linear infinite", color: "var(--accent-primary)" }} />
      <p style={{ color: "var(--text-secondary)" }}>Authenticating...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}><Loader2 size={48} style={{ animation: "spin 1s linear infinite", color: "var(--accent-primary)" }} /></div>}>
      <CallbackContent />
    </Suspense>
  );
}
