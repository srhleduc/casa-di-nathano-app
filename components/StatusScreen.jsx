"use client";

import { useEffect } from "react";

export default function StatusScreen({ title, subtitle, success, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      {success && <span className="text-7xl mb-6">✅</span>}
      <h2 className="display-font text-4xl font-semibold mb-4">{title}</h2>
      <p className="text-[#c9b8a4] text-lg max-w-md">{subtitle}</p>
    </div>
  );
}
