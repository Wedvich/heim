import type { Command } from "../commands.ts";

export interface CreateProductTypePayload extends Readonly<Record<string, unknown>> {
  readonly name: string;
  readonly category?: string | null;
}

export interface UpdateProductTypePayload extends Readonly<Record<string, unknown>> {
  readonly name?: string;
  readonly category?: string | null;
}

export type ProductTypeCommandPayload =
  | { readonly type: "CreateProductType"; readonly payload: CreateProductTypePayload }
  | { readonly type: "UpdateProductType"; readonly payload: UpdateProductTypePayload };

export type ProductTypeCommand = Command & ProductTypeCommandPayload;
