import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Listen for custom "optimistic-error" events dispatched anywhere in the app.
 * Usage: window.dispatchEvent(new CustomEvent("optimistic-error", { detail: { message: "..." } }))
 */
export default function GlobalErrorToast() {
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const msg = e.detail?.message || "Une erreur est survenue. Veuillez réessayer.";
      const id = Date.now();
      setErrors(prev => [...prev, { id, msg }]);
      setTimeout(() => setErrors(prev => prev.filter(err => err.id !== id)), 5000);
    };
    window.addEventListener("optimistic-error", handler);
    return () => window.removeEventListener("optimistic-error", handler);
  }, []);

  if (errors.length === 0) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-md px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
    >
      {errors.map(({ id, msg }) => (
        <div
          key={id}
          className="flex items-start gap-3 px-4 py-3"
          style={{
            background: "var(--v1v-danger)",
            color: "#fff",
            boxShadow: "0 4px 24px rgba(180,30,30,0.35)",
          }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-black uppercase tracking-[0.2em] flex-1">{msg}</p>
          <button
            onClick={() => setErrors(prev => prev.filter(e => e.id !== id))}
            aria-label="Dismiss error"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 -mt-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}