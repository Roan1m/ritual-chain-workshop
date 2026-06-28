import { useState } from "react";
import { Card, CardHeader, CardBody, Field, Input, Button } from "@/ui";

export function LoadBounty({
  selectedId,
  onSelect,
}: {
  selectedId: bigint | null;
  onSelect: (id: bigint | null) => void;
}) {
  const [value, setValue] = useState(selectedId !== null ? selectedId.toString() : "");

  function load(e: React.FormEvent) {
    e.preventDefault();
    const t = value.trim();
    if (t === "") return onSelect(null);
    try {
      const id = BigInt(t);
      if (id >= 0n) onSelect(id);
    } catch {
      /* not a number */
    }
  }

  return (
    <Card>
      <CardHeader title="Open a bounty" subtitle="Load any bounty by its numeric id." />
      <CardBody>
        <form onSubmit={load} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Bounty id">
              <Input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="1" />
            </Field>
          </div>
          <Button type="submit">Open</Button>
        </form>
        <p className="mt-3 text-xs text-stone-500">
          The newest bounty id is shown after you create one.
        </p>
      </CardBody>
    </Card>
  );
}
