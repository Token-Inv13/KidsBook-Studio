export const VIRTUALIZATION_THRESHOLD = 50;

export const getDynamicTableHeight = (
  viewportHeight,
  {
    reservedHeight = 380,
    minHeight = 260,
    maxHeight = 920
  } = {}
) => {
  const rawHeight = viewportHeight - reservedHeight;
  return Math.max(minHeight, Math.min(maxHeight, rawHeight));
};

export const shouldUseVirtualization = (totalRows, threshold = VIRTUALIZATION_THRESHOLD) => {
  return totalRows > threshold;
};

export const getVirtualWindow = ({
  scrollTop = 0,
  rowHeight = 88,
  containerHeight = 420,
  totalRows = 0,
  overscan = 6
} = {}) => {
  if (totalRows <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      topPadding: 0,
      bottomPadding: 0
    };
  }

  const firstVisibleIndex = Math.floor(scrollTop / rowHeight);
  const visibleCount = Math.ceil(containerHeight / rowHeight);

  const startIndex = Math.max(0, firstVisibleIndex - overscan);
  const endIndex = Math.min(totalRows, firstVisibleIndex + visibleCount + overscan);

  const topPadding = startIndex * rowHeight;
  const bottomPadding = Math.max(0, (totalRows - endIndex) * rowHeight);

  return {
    startIndex,
    endIndex,
    topPadding,
    bottomPadding
  };
};
