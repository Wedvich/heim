import { useState } from "react";
import type { SpotState } from "@heim/domain";
import { executeCommand } from "../../sync/execute-command";
import { useAuth } from "../../auth/auth-context";

interface SpotEditorProps {
  readonly roomId: string;
  readonly spot: SpotState;
}

export function SpotEditor({ roomId, spot }: SpotEditorProps): React.ReactElement {
  const { session } = useAuth();
  const [name, setName] = useState(spot.name);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(): Promise<void> {
    const trimmed = name.trim();
    if (!session || trimmed === spot.name || trimmed.length === 0) return;

    setError(null);
    const result = await executeCommand({
      streamId: roomId,
      streamType: "Room",
      type: "RenameSpot",
      payload: { spotId: spot.spotId, name: trimmed },
      tenantId: session.tenant!.id,
      principalId: session.principal.id,
    });

    if (!result.ok) {
      setError(result.reason ?? result.error);
      setName(spot.name);
    }
  }

  async function handleRemove(): Promise<void> {
    if (!session) return;

    setError(null);
    const result = await executeCommand({
      streamId: roomId,
      streamType: "Room",
      type: "RemoveSpot",
      payload: { spotId: spot.spotId },
      tenantId: session.tenant!.id,
      principalId: session.principal.id,
    });

    if (!result.ok) {
      setError(result.reason ?? result.error);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void handleRename()}
          onKeyDown={handleKeyDown}
          maxLength={100}
          style={{ flex: 1, padding: "4px 8px" }}
        />
        <span style={{ color: "var(--color-text-secondary)", fontSize: 13, minWidth: 64 }}>
          {spot.kind}
        </span>
        <button
          onClick={() => void handleRemove()}
          title="Remove spot"
          style={{
            cursor: "pointer",
            background: "none",
            border: "none",
            color: "var(--color-text-secondary)",
            fontSize: 16,
          }}
        >
          ×
        </button>
      </div>
      {error && (
        <p style={{ color: "var(--color-error)", fontSize: 13, margin: "2px 0 0" }}>{error}</p>
      )}
    </div>
  );
}
