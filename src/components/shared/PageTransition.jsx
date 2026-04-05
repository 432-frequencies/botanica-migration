import { useEffect, useState } from "react";

export default function PageTransition({ children }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: "opacity 150ms ease-out" }}>
      {children}
    </div>
  );
}