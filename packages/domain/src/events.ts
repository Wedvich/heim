export interface DomainEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly streamId: string;
  readonly streamType: string;
  readonly streamPosition: number;
  readonly eventType: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly actingPrincipalId: string;
  readonly effectivePrincipalId: string | null;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly actualTime: Date;
}

export interface UserCreatedPayload extends Record<string, unknown> {
  readonly provider: string;
  readonly providerSubjectId: string;
  readonly merged: boolean;
}

export interface UserCreatedEvent extends DomainEvent {
  readonly eventType: "UserCreated";
  readonly streamType: "User";
  readonly payload: UserCreatedPayload;
}

export type UserEvent = UserCreatedEvent;

export interface TenantCreatedPayload extends Record<string, unknown> {
  readonly name: string;
  readonly slug: string;
  readonly createdByPrincipalId: string;
}

export interface TenantCreatedEvent extends DomainEvent {
  readonly eventType: "TenantCreated";
  readonly streamType: "Tenant";
  readonly payload: TenantCreatedPayload;
}

export type TenantEvent = TenantCreatedEvent;
