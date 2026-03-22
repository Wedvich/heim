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

export interface MemberAddedPayload extends Record<string, unknown> {
  readonly principalId: string;
  readonly role: string;
}

export interface MemberAddedEvent extends DomainEvent {
  readonly eventType: "MemberAdded";
  readonly streamType: "Tenant";
  readonly payload: MemberAddedPayload;
}

export interface MemberRemovedPayload extends Record<string, unknown> {
  readonly principalId: string;
}

export interface MemberRemovedEvent extends DomainEvent {
  readonly eventType: "MemberRemoved";
  readonly streamType: "Tenant";
  readonly payload: MemberRemovedPayload;
}

export interface TenantRenamedPayload extends Record<string, unknown> {
  readonly newName: string;
}

export interface TenantRenamedEvent extends DomainEvent {
  readonly eventType: "TenantRenamed";
  readonly streamType: "Tenant";
  readonly payload: TenantRenamedPayload;
}

export type TenantEvent =
  | TenantCreatedEvent
  | MemberAddedEvent
  | MemberRemovedEvent
  | TenantRenamedEvent;
