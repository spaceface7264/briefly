"use client";

import { useEffect, useRef } from "react";

export type ColumnKey =
  | "category"
  | "duration"
  | "price"
  | "claims"
  | "status"
  | "created"
  | "actions";

type HiddenField = {
  name: string;
  value: string;
};

type ColumnsDropdownProps = {
  columns: ColumnKey[];
  visibleColumns: ColumnKey[];
  hiddenFields: HiddenField[];
};

export function ColumnsDropdown({ columns, visibleColumns, hiddenFields }: ColumnsDropdownProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (!details.contains(event.target as Node)) {
        details.open = false;
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <details ref={detailsRef} className="relative">
      <summary className="list-none cursor-pointer px-3 py-2 rounded-lg border border-border text-sm hover:border-accent/50 transition-colors">
        Columns
      </summary>
      <form
        action="/admin/briefs"
        method="get"
        className="absolute right-0 mt-2 z-10 min-w-56 rounded-lg border border-border bg-surface p-3 shadow-lg space-y-2"
      >
        {hiddenFields.map((field) => (
          <input key={`${field.name}-${field.value}`} type="hidden" name={field.name} value={field.value} />
        ))}
        {columns.map((column) => (
          <label key={column} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="cols"
              value={column}
              defaultChecked={visibleColumns.includes(column)}
              className="accent-accent"
            />
            <span className="capitalize">{column}</span>
          </label>
        ))}
        <button
          type="submit"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm hover:border-accent/50 transition-colors"
        >
          Update columns
        </button>
      </form>
    </details>
  );
}
