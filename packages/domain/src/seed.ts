export interface SeedCommand {
  readonly streamId: string;
  readonly streamType: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly actualTime?: string;
}

export interface SeedFile {
  readonly version: 1;
  readonly commands: readonly SeedCommand[];
}

export interface SnapshotToSeedOptions {
  readonly streamTypes?: readonly string[];
}

interface AggregateSnapshot {
  readonly streamId: string;
  readonly streamType: string;
  readonly state: Record<string, unknown>;
}

type SnapshotConverter = (snapshot: AggregateSnapshot) => SeedCommand;

const EXCLUDED_STREAM_TYPES = new Set(["Tenant", "User"]);

const CONVERTER_REGISTRY = new Map<string, SnapshotConverter>();

const STREAM_TYPE_PRIORITY = new Map<string, number>();

export function registerSeedConverter(
  streamType: string,
  converter: SnapshotConverter,
  priority: number,
): void {
  CONVERTER_REGISTRY.set(streamType, converter);
  STREAM_TYPE_PRIORITY.set(streamType, priority);
}

export function snapshotsToSeedFile(
  snapshots: readonly AggregateSnapshot[],
  options?: SnapshotToSeedOptions,
): SeedFile {
  const allowedTypes = options?.streamTypes ? new Set(options.streamTypes) : null;

  const commands: SeedCommand[] = [];

  for (const snapshot of snapshots) {
    if (EXCLUDED_STREAM_TYPES.has(snapshot.streamType)) continue;
    if (allowedTypes && !allowedTypes.has(snapshot.streamType)) continue;

    const converter = CONVERTER_REGISTRY.get(snapshot.streamType);
    if (!converter) continue;

    commands.push(converter(snapshot));
  }

  commands.sort((a, b) => {
    const pa = STREAM_TYPE_PRIORITY.get(a.streamType) ?? Number.MAX_SAFE_INTEGER;
    const pb = STREAM_TYPE_PRIORITY.get(b.streamType) ?? Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });

  return { version: 1, commands };
}

// Built-in converters for inventory aggregates

registerSeedConverter(
  "ProductType",
  (snap) => ({
    streamId: snap.streamId,
    streamType: "ProductType",
    type: "CreateProductType",
    payload: {
      name: snap.state.name as string,
      ...(snap.state.category != null ? { category: snap.state.category } : {}),
    },
  }),
  10,
);

registerSeedConverter(
  "StockItem",
  (snap) => ({
    streamId: snap.streamId,
    streamType: "StockItem",
    type: "AddStockItem",
    payload: {
      productTypeId: snap.state.productTypeId as string,
      level: snap.state.level as string,
      ...(snap.state.exactCount != null ? { exactCount: snap.state.exactCount } : {}),
      ...(snap.state.expiryDate != null ? { expiryDate: snap.state.expiryDate } : {}),
      ...(snap.state.purchaseDate != null ? { purchaseDate: snap.state.purchaseDate } : {}),
    },
  }),
  20,
);
