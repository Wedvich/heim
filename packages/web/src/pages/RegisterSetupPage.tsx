import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/auth-context";
import {
  checkSlugAvailable,
  completeRegistration,
  fetchRegistrationContext,
  type SlugCheckResult,
} from "../auth/api";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

type SlugStatus = "idle" | "checking" | "available" | "unavailable" | "invalid";

export function RegisterSetupPage() {
  const { status, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [slugReason, setSlugReason] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (status === "authenticated") {
      void navigate("/", { replace: true });
    }
  }, [status, navigate]);

  const validateSlug = useCallback(
    (value: string) => {
      if (!inviteToken) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value || value.length < 3) {
        setSlugStatus("idle");
        return;
      }

      setSlugStatus("checking");
      debounceRef.current = setTimeout(async () => {
        try {
          const result: SlugCheckResult = await checkSlugAvailable(value, inviteToken);
          if (!result.valid) {
            setSlugStatus("invalid");
            setSlugReason(result.reason);
          } else if (result.available) {
            setSlugStatus("available");
            setSlugReason(undefined);
          } else {
            setSlugStatus("unavailable");
            setSlugReason(undefined);
          }
        } catch {
          setSlugStatus("idle");
        }
      }, 300);
    },
    [inviteToken],
  );

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    fetchRegistrationContext().then((ctx) => {
      if (cancelled || !ctx.suggestedTenantName) return;
      const suggested = ctx.suggestedTenantName;
      setTenantName((prev) => {
        if (prev) return prev;
        const generated = generateSlug(suggested);
        setSlug(generated);
        validateSlug(generated);
        return suggested;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [inviteToken, validateSlug]);

  function handleNameChange(value: string) {
    setTenantName(value);
    if (!slugEdited) {
      const generated = generateSlug(value);
      setSlug(generated);
      validateSlug(generated);
    }
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(value);
    validateSlug(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantName.trim() || !slug.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await completeRegistration(tenantName.trim(), slug.trim());
      if (result.error) {
        if (result.error === "registration_expired") {
          const params = new URLSearchParams({ error: "registration_expired" });
          if (inviteToken) params.set("invite", inviteToken);
          void navigate(`/register?${params.toString()}`, { replace: true });
          return;
        }
        setError(errorMessage(result.error));
      } else {
        await refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!inviteToken) {
    return (
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}
      >
        <h1>Set Up Your Space</h1>
        <p style={{ color: "var(--color-error)", marginTop: 16 }}>
          An invite link is required to register.
        </p>
      </div>
    );
  }

  const canSubmit =
    tenantName.trim().length > 0 &&
    slug.trim().length >= 3 &&
    slugStatus === "available" &&
    !submitting;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
      <h1>Set Up Your Space</h1>
      <p style={{ color: "var(--color-muted)", marginTop: 8 }}>
        Choose a name and URL for your space.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24, width: 320 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>Space name</span>
          <input
            type="text"
            value={tenantName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="My Family"
            autoFocus
            maxLength={100}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>URL slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="my-family"
            maxLength={48}
          />
          <SlugFeedback status={slugStatus} reason={slugReason} />
        </label>

        {error && <p style={{ color: "var(--color-error)", margin: 0 }}>{error}</p>}

        <button type="submit" disabled={!canSubmit}>
          {submitting ? "Creating…" : "Create Space"}
        </button>
      </form>
    </div>
  );
}

function SlugFeedback({ status, reason }: { status: SlugStatus; reason?: string }) {
  switch (status) {
    case "checking":
      return <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Checking…</span>;
    case "available":
      return <span style={{ fontSize: 13, color: "var(--color-success)" }}>Available</span>;
    case "unavailable":
      return <span style={{ fontSize: 13, color: "var(--color-error)" }}>Already taken</span>;
    case "invalid":
      return (
        <span style={{ fontSize: 13, color: "var(--color-error)" }}>
          {slugReasonMessage(reason)}
        </span>
      );
    default:
      return null;
  }
}

function slugReasonMessage(reason?: string): string {
  switch (reason) {
    case "too_short":
      return "Must be at least 3 characters";
    case "too_long":
      return "Must be 48 characters or fewer";
    case "invalid_characters":
      return "Only lowercase letters, numbers, and hyphens";
    case "reserved":
      return "This slug is reserved";
    default:
      return "Invalid slug";
  }
}

function errorMessage(code: string): string {
  switch (code) {
    case "invalid_invite":
      return "This invite link is invalid or has expired.";
    case "already_registered":
      return "This account is already registered. Try signing in instead.";
    case "missing_tenant_name":
      return "Please enter a name for your space.";
    case "invalid_slug":
      return "The URL slug is invalid.";
    case "slug_taken":
      return "This URL slug is already taken. Please choose another.";
    default:
      return "Registration failed. Please try again.";
  }
}
