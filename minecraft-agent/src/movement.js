export function configureSafeMovements(movements) {
  movements.canDig = false;
  movements.allow1by1towers = false;
  movements.scaffoldingBlocks = [];
  return movements;
}
