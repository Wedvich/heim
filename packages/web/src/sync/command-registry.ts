import {
  CommandHandlerRegistry,
  inventoryItemHandler,
  productTypeHandler,
  roomHandler,
  tenantHandler,
} from "@heim/domain";

export const commandRegistry = new CommandHandlerRegistry()
  .register(tenantHandler)
  .register(productTypeHandler)
  .register(inventoryItemHandler)
  .register(roomHandler);
