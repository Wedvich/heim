import { useState } from "react";
import { v7 as uuidv7 } from "uuid";
import { SPOT_KINDS, type SpotKind } from "@heim/domain";
import { executeCommand } from "../../sync/execute-command";
import { useAuth } from "../../auth/auth-context";

const SPOT_KIND_OPTIONS = Object.keys(SPOT_KINDS) as SpotKind[];

interface AddSpotFormProps {
  readonly roomId: string;
  readonly nextSortOrder: number;
}

export function AddSpotForm({ roomId, nextSortOrder }: AddSpotFormProps): React.ReactElement {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SpotKind>("storage");
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canAdd = trimmed.length > 0;

  async function handleAdd(): Promise<void> {
    if (!canAdd || !session) return;

    setError(null);
    const result = await executeCommand({
      streamId: roomId,
      streamType: "Room",
      type: "AddSpot",
      payload: { spotId: uuidv7(), name: trimmed, kind, sortOrder: nextSortOrder },
      tenantId: session.tenant!.id,
      principalId: session.principal.id,
    });

    if (result.ok) {
      setName("");
    } else {
      setError(result.reason ?? result.error);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      void handleAdd();
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          type="text"
          placeholder="Spot name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={100}
          style={{ flex: 1, padding: "4px 8px" }}
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as SpotKind)}
          style={{ padding: "4px 8px" }}
        >
          {SPOT_KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          onClick={() => void handleAdd()}
          disabled={!canAdd}
          style={{ padding: "4px 12px", cursor: canAdd ? "pointer" : "default" }}
        >
          Add
        </button>
      </div>
      {error && (
        <p style={{ color: "var(--color-error)", fontSize: 13, margin: "2px 0 0" }}>{error}</p>
      )}
    </div>
  );
}
