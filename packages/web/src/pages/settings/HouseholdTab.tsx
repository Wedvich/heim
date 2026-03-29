import { useState } from "react";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";
import { v7 as uuidv7 } from "uuid";
import { useAuth } from "../../auth/auth-context";
import { executeCommand } from "../../sync/execute-command";
import { syncStore } from "../../sync/sync-store";
import { RoomModel } from "../../sync/room-model";
import { RoomEditor } from "./RoomEditor";

export const HouseholdTab = observer(function HouseholdTab(): React.ReactElement {
  const { session, refresh } = useAuth();

  const tenantId = session?.tenant?.id;
  const tenant = tenantId ? syncStore.tenants.get(tenantId) : undefined;

  const [tenantName, setTenantName] = useState(tenant?.name ?? "");
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);

  const trimmedTenantName = tenantName.trim();
  const tenantUnchanged = trimmedTenantName === tenant?.name;
  const canSaveTenant = trimmedTenantName.length > 0 && !tenantUnchanged && !savingTenant;

  async function handleSaveTenant(): Promise<void> {
    if (!canSaveTenant || !tenantId || !session) return;

    setSavingTenant(true);
    setTenantError(null);

    const result = await executeCommand({
      streamId: tenantId,
      streamType: "Tenant",
      type: "RenameTenant",
      payload: { newName: trimmedTenantName },
      tenantId,
      principalId: session.principal.id,
    });

    setSavingTenant(false);

    if (result.ok) {
      await refresh();
    } else {
      setTenantError(result.reason ?? result.error);
    }
  }

  // Rooms

  const [newRoomName, setNewRoomName] = useState("");
  const [roomError, setRoomError] = useState<string | null>(null);

  const rooms = [...syncStore.rooms.values()]
    .filter((r) => !r.archived && r.name !== null)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  const trimmedRoomName = newRoomName.trim();
  const canAddRoom = trimmedRoomName.length > 0;

  async function handleAddRoom(): Promise<void> {
    if (!canAddRoom || !session || !tenantId) return;

    setRoomError(null);

    const roomId = uuidv7();
    runInAction(() => {
      syncStore.rooms.set(roomId, new RoomModel(roomId));
    });

    const result = await executeCommand({
      streamId: roomId,
      streamType: "Room",
      type: "CreateRoom",
      payload: { name: trimmedRoomName },
      tenantId,
      principalId: session.principal.id,
    });

    if (result.ok) {
      setNewRoomName("");
    } else {
      runInAction(() => {
        syncStore.rooms.delete(roomId);
      });
      setRoomError(result.reason ?? result.error);
    }
  }

  function handleRoomKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      void handleAddRoom();
    }
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <section>
        <h2 style={{ marginTop: 0 }}>Household name</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            maxLength={100}
            disabled={savingTenant}
            style={{ flex: 1, padding: "8px 12px" }}
          />
          <button
            onClick={() => void handleSaveTenant()}
            disabled={!canSaveTenant}
            style={{ padding: "8px 16px", cursor: canSaveTenant ? "pointer" : "default" }}
          >
            {savingTenant ? "Saving..." : "Save"}
          </button>
        </div>
        {tenantError && <p style={{ color: "var(--color-error)", marginTop: 8 }}>{tenantError}</p>}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Rooms</h2>
        {rooms.length === 0 && (
          <p style={{ color: "var(--color-text-secondary)" }}>No rooms yet.</p>
        )}
        {rooms.map((room) => (
          <RoomEditor key={room.streamId} room={room} />
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            type="text"
            placeholder="New room name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyDown={handleRoomKeyDown}
            maxLength={100}
            style={{ flex: 1, padding: "8px 12px" }}
          />
          <button
            onClick={() => void handleAddRoom()}
            disabled={!canAddRoom}
            style={{ padding: "8px 16px", cursor: canAddRoom ? "pointer" : "default" }}
          >
            Add room
          </button>
        </div>
        {roomError && <p style={{ color: "var(--color-error)", marginTop: 8 }}>{roomError}</p>}
      </section>
    </div>
  );
});
