import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { createApiUrl } from "@/lib/app-config";

const INITIAL_STATE = {
  checking: true,
  authenticated: false,
  isAdmin: false,
  email: "",
  error: "",
};

export function useAdminStatus() {
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session?.access_token) {
          setState({
            checking: false,
            authenticated: false,
            isAdmin: false,
            email: "",
            error: "",
          });
          return;
        }

        const response = await fetch(createApiUrl("/api/admin-session"), {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));
        if (!isMounted) return;

        if (!response.ok) {
          setState({
            checking: false,
            authenticated: false,
            isAdmin: false,
            email: payload?.email || session.user?.email || "",
            error: payload?.error || "Impossible de vérifier l'accès admin",
          });
          return;
        }

        setState({
          checking: false,
          authenticated: payload?.authenticated !== false,
          isAdmin: !!payload?.isAdmin,
          email: payload?.email || session.user?.email || "",
          error: payload?.error || "",
        });
      } catch (error) {
        if (!isMounted) return;
        setState({
          checking: false,
          authenticated: false,
          isAdmin: false,
          email: "",
          error: error?.message || "Impossible de vérifier l'accès admin",
        });
      }
    };

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setState((prev) => ({ ...prev, checking: true }));
      load();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
