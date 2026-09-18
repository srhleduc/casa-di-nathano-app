"use client";

import { groupItemsForDisplay } from "@/lib/business";
import ItemLine from "./ItemLine";

export default function GroupedItemList({ items, className, showSource, onAckItem }) {
  return (
    <div className={className}>
      {groupItemsForDisplay(items).map((group, gi) => (
        <ul key={gi} className={`text-sm ${gi > 0 ? "mt-2 pt-2 border-t" : ""}`} style={{ color: "var(--color-text-subtle)", borderColor: gi > 0 ? "var(--color-border)" : undefined }}>
          {group.map((it, idx) => (
            <ItemLine key={idx} it={it} showSource={showSource} onAck={onAckItem} />
          ))}
        </ul>
      ))}
    </div>
  );
}
