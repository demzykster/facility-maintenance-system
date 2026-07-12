const sizesOf = (item) => (Array.isArray(item?.sizes) && item.sizes.length ? item.sizes : ["אחיד"]);
const stockOf = (item, size) => {
  const value = item?.stockBySize?.[size];
  return typeof value === "number" ? value : 0;
};
const minOf = (item, size) => {
  if (!item) return 0;
  if (item.minBySize) return Number(item.minBySize[size] || 0) || 0;
  return sizesOf(item).length <= 1 ? Number(item.minStock || 0) || 0 : 0;
};
const maxOf = (item, size) => Number(item?.maxBySize?.[size] || 0) || 0;

export function ppeOpenOrderQty(item, size, orders = []) {
  if (!item?.id) return 0;
  return (orders || [])
    .filter((order) => order?.status === "draft" || order?.status === "sent")
    .reduce((sum, order) => sum + (order.lines || [])
      .filter((line) => line.itemId === item.id && line.size === size)
      .reduce((lineSum, line) => lineSum + Math.max(0, Number(line.qty || 0) - Number(line.received || 0)), 0), 0);
}

export function ppeSmartReorderLinesForItem(item, orders = []) {
  if (!item || item.active === false) return [];
  return sizesOf(item).map((size) => {
    const min = minOf(item, size);
    if (min <= 0) return null;
    const max = maxOf(item, size);
    const covered = stockOf(item, size) + ppeOpenOrderQty(item, size, orders);
    if (covered >= min) return null;
    const target = max > min ? max : min;
    const need = Math.max(0, target - covered);
    return need > 0 ? { size, need } : null;
  }).filter(Boolean);
}

export function ppeSmartReorderLines(items = [], orders = []) {
  return (items || [])
    .filter((item) => item?.active !== false)
    .flatMap((item) => ppeSmartReorderLinesForItem(item, orders).map((deficit) => ({
      itemId: item.id,
      itemName: item.name,
      sku: item.sku || "",
      category: item.category,
      size: deficit.size,
      qty: deficit.need,
      received: 0
    })));
}
