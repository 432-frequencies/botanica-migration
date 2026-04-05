import { createContext, useContext } from "react";

// Fournit le nom de la page active aux pages KeepAlive
// pour qu'elles puissent différer leur loadData jusqu'à leur première activation.
export const ActivePageContext = createContext(null);

export function useIsActivePage(pageName) {
  const activePage = useContext(ActivePageContext);
  return activePage === pageName;
}