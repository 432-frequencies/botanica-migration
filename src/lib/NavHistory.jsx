import { createContext, useContext, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const NavHistoryContext = createContext(null);

/**
 * Maintains an in-memory navigation stack so back buttons work correctly
 * regardless of browser history state (iframe, PWA, first visit, etc.)
 */
export function NavHistoryProvider({ children }) {
  const stackRef = useRef(["/"]);
  const navigate = useNavigate();

  const push = useCallback((path) => {
    stackRef.current = [...stackRef.current, path];
  }, []);

  const canGoBack = useCallback(() => stackRef.current.length > 1, []);

  const goBack = useCallback(() => {
    if (stackRef.current.length > 1) {
      stackRef.current = stackRef.current.slice(0, -1);
      const prev = stackRef.current[stackRef.current.length - 1];
      navigate(prev, { replace: true });
    } else {
      navigate("/");
    }
  }, [navigate]);

  return (
    <NavHistoryContext.Provider value={{ push, canGoBack, goBack }}>
      {children}
    </NavHistoryContext.Provider>
  );
}

export function useNavHistory() {
  return useContext(NavHistoryContext);
}