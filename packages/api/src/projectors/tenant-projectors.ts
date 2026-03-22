import type { ProjectorRegistry } from "../event-store/projector-registry.ts";

export function registerTenantProjectors(registry: ProjectorRegistry): void {
  registry.register("Tenant", "TenantRenamed", async (client, event) => {
    const payload = event.payload as { newName: string };
    await client.query(`UPDATE tenants SET name = $1 WHERE id = $2`, [
      payload.newName,
      event.tenantId,
    ]);
  });
}
