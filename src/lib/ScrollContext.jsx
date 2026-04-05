import { createContext, useContext, useRef } from "react";

const ScrollContext = createContext(null);

export function ScrollProvider({ children }) {
  const positions = useRef({});

  const save = (page, el) => {
    if (el) positions.current[page] = el.scrollTop;
  };

  const restore = (page, el) => {
    if (el) el.scrollTop = positions.current[page] ?? 0;
  };

  return (
    <ScrollContext.Provider value={{ save, restore }}>
      {children}
    </ScrollContext.Provider>
  );
}

export const useScroll = () => useContext(ScrollContext);