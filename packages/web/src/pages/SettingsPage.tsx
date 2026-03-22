import { useState } from "react";
import { Link } from "react-router";
import { observer } from "mobx-react-lite";
import { useAuth } from "../auth/auth-context";
import { executeCommand } from "../sync/execute-command";
import { syncStore } from "../sync/sync-store";

export const SettingsPage = observer(function SettingsPage() {
  const { session, refresh } = useAuth();

  const tenantId = session?.tenant?.id;
  const tenant = tenantId ? syncStore.tenants.get(tenantId) : undefined;

  const [name, setName] = useState(tenant?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const unchanged = trimmed === tenant?.name;
  const canSave = trimmed.length > 0 && !unchanged && !saving;

  async function handleSave(): Promise<void> {
    if (!canSave || !tenantId || !session) return;

    setSaving(true);
    setError(null);

    const result = await executeCommand({
      streamId: tenantId,
      streamType: "Tenant",
      type: "RenameTenant",
      payload: { newName: trimmed },
      tenantId,
      principalId: session.principal.id,
    });

    setSaving(false);

    if (result.ok) {
      await refresh();
    } else {
      setError(result.reason ?? result.error);
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 480 }}>
      <h1>Settings</h1>
      <Link to="/">← Back</Link>

      <section style={{ marginTop: 24 }}>
        <h2>Household name</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            disabled={saving}
            style={{ flex: 1, padding: "8px 12px" }}
          />
          <button
            onClick={() => void handleSave()}
            disabled={!canSave}
            style={{ padding: "8px 16px", cursor: canSave ? "pointer" : "default" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
        {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}
      </section>
    </div>
  );
});
