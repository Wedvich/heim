import {
  CommandHandlerRegistry,
  productTypeHandler,
  stockItemHandler,
  tenantHandler,
} from "@heim/domain";

export const commandRegistry = new CommandHandlerRegistry()
  .register(tenantHandler)
  .register(productTypeHandler)
  .register(stockItemHandler);
