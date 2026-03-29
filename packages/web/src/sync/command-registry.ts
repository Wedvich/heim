import {
  CommandHandlerRegistry,
  inventoryItemHandler,
  productTypeHandler,
  tenantHandler,
} from "@heim/domain";

export const commandRegistry = new CommandHandlerRegistry()
  .register(tenantHandler)
  .register(productTypeHandler)
  .register(inventoryItemHandler);
