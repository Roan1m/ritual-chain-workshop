"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody, Field, Input, Button } from "@/components/ui";

export function LoadBountyPanel({
  selectedId,
  onSelect,
  recentIds,
}: {
  selectedId: bigint | null;
  onSelect: (id: bigint | null) => void;
  recentIds: string[];
}) {
  // `override === null` => show the current selection; typing takes over.
  const [override, setOverride] = useState<string | null>(null);
  const value =
    override ?? (selectedId !== null ? selectedId.toString() : "");

  function load(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onSelect(null);
      return;
    }
    try {
      const id = BigInt(trimmed);
      if (id < 0n) return;
      onSelect(id);
    } catch {
      /* not a number — ignore */
    }
  }

  return (
    <Card>
      <CardHeader
        title="Load a bounty"
        subtitle="Open any bounty by its numeric id."
      />
      <CardBody className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(value);
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <Field label="Bounty id">
              <Input
                inputMode="numeric"
                value={value}
                onChange={(e) => setOverride(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
          <Button type="submit">Load</Button>
        </form>

        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> Recent bounties
          </div>
          {recentIds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {recentIds.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setOverride(null);
                    load(id);
                  }}
                  className={`rounded-lg px-2.5 py-1 font-mono text-xs ring-1 ring-inset transition-colors ${
                    selectedId?.toString() === id
                      ? "bg-amber-500/20 text-amber-200 ring-amber-500/40"
                      : "bg-white/[0.03] text-stone-300 ring-white/10 hover:bg-white/[0.08]"
                  }`}
                >
                  #{id}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-600">
              No bounties opened yet — create one, or load any by its id.
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
