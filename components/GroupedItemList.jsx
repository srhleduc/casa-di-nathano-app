"use client";

import { groupItemsForDisplay } from "@/lib/business";
import ItemLine from "./ItemLine";

export default function GroupedItemList({ items, className, showSource }) {
  return (
    <div className={className}>
      {groupItemsForDisplay(items).map((group, gi) => (
        <ul key={gi} className={`text-sm text-[#c9b8a4] ${gi > 0 ? "mt-2 pt-2 border-t border-[#3a2b1f]" : ""}`}>
          {group.map((it, idx) => (
            <ItemLine key={idx} it={it} showSource={showSource} />
          ))}
        </ul>
      ))}
    </div>
  );
}
