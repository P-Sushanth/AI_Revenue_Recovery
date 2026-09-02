"use client";

import type { ReactNode } from "react";
import { intFmt } from "../chart-formatters";

export interface TooltipRow {
  color: string;
  label: string;
  value: string | number;
}

export interface TooltipContentProps {
  title?: string;
  rows: TooltipRow[];
  /** Optional additional content (e.g., markers) */
  children?: ReactNode;
}

export function TooltipContent({ title, rows, children }: TooltipContentProps) {
  return (
    <div className="overflow-hidden">
      <div className="px-3.5 py-2.5">
        {title && (
          <div className="mb-2 text-left font-bold text-neutral-900 text-xs uppercase tracking-wider">
            {title}
          </div>
        )}
        <div className="space-y-1.5">
          {rows.map((row) => {
            const rawLabel = String(row.label || "");
            const displayLabel = rawLabel === "value" ? "Count" : rawLabel.replace(/_/g, " ");
            return (
              <div
                className="flex items-center justify-between gap-4"
                key={`${row.label}-${row.color}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full border border-neutral-200 shadow-2xs"
                    style={{ backgroundColor: row.color || "#171717" }}
                  />
                  <span className="text-neutral-500 text-xs font-medium capitalize">
                    {displayLabel}
                  </span>
                </div>
                <span className="font-bold text-neutral-900 text-xs tabular-nums">
                  {typeof row.value === "number" ? intFmt(row.value) : row.value}
                </span>
              </div>
            );
          })}
        </div>

        {children && (
          <div className="mt-2 transition-opacity duration-200 ease-out">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

TooltipContent.displayName = "TooltipContent";

export default TooltipContent;
