import { useState } from "react";
import { observer } from "mobx-react-lite";
import type { RoomModel } from "../../sync/room-model";
import { executeCommand } from "../../sync/execute-command";
import { useAuth } from "../../auth/auth-context";
import { SpotEditor } from "./SpotEditor";
import { AddSpotForm } from "./AddSpotForm";

interface RoomEditorProps {
  readonly room: RoomModel;
}

export const RoomEditor = observer(function RoomEditor({
  room,
}: RoomEditorProps): React.ReactElement {
  const { session } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(room.name ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleRename(): Promise<void> {
    const trimmed = name.trim();
    if (!session || trimmed === room.name || trimmed.length === 0) return;

    setError(null);
    const result = await executeCommand({
      streamId: room.streamId,
      streamType: "Room",
      type: "RenameRoom",
      payload: { name: trimmed },
      tenantId: session.tenant!.id,
      principalId: session.principal.id,
    });

    if (!result.ok) {
      setError(result.reason ?? result.error);
      setName(room.name ?? "");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }

  const spots = room.spotList;

  return (
    <div style={{ borderBottom: "1px solid var(--color-border)", padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 4px",
            color: "var(--color-text)",
            fontSize: 12,
          }}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "\u25BC" : "\u25B6"}
        </button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void handleRename()}
          onKeyDown={handleKeyDown}
          maxLength={100}
          style={{ flex: 1, padding: "4px 8px" }}
        />
        <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
          {spots.length} {spots.length === 1 ? "spot" : "spots"}
        </span>
      </div>
      {error && (
        <p style={{ color: "var(--color-error)", fontSize: 13, margin: "4px 0 0 28px" }}>{error}</p>
      )}
      {expanded && (
        <div style={{ marginLeft: 28, marginTop: 8 }}>
          {spots.map((spot) => (
            <SpotEditor key={spot.spotId} roomId={room.streamId} spot={spot} />
          ))}
          <AddSpotForm roomId={room.streamId} nextSortOrder={spots.length} />
        </div>
      )}
    </div>
  );
});
