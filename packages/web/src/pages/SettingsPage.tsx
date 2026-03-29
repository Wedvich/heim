import { Link, useSearchParams } from "react-router";
import { observer } from "mobx-react-lite";
import { AccountTab } from "./settings/AccountTab";
import { HouseholdTab } from "./settings/HouseholdTab";

const TABS = [
  { key: "account", label: "Account" },
  { key: "household", label: "Household" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export const SettingsPage = observer(function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) ?? "account";

  function selectTab(tab: TabKey): void {
    setSearchParams(tab === "account" ? {} : { tab });
  }

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link to="/">← Back</Link>
        <h1 style={{ margin: 0 }}>Settings</h1>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-border)" }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => selectTab(key)}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: activeTab === key ? "var(--color-text)" : "var(--color-text-secondary)",
              borderBottom:
                activeTab === key ? "2px solid var(--color-text)" : "2px solid transparent",
              fontWeight: activeTab === key ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "account" ? <AccountTab /> : <HouseholdTab />}
    </div>
  );
});
