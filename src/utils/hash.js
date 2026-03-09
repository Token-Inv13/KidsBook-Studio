const stableSerialize = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (seen.has(value)) {
    throw new Error('stableHash does not support circular references');
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const serializedItems = value.map((item) => {
      if (typeof item === 'undefined' || typeof item === 'function' || typeof item === 'symbol') {
        return 'null';
      }
      return stableSerialize(item, seen);
    });
    seen.delete(value);
    return `[${serializedItems.join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const serializedProps = [];

  keys.forEach((key) => {
    const prop = value[key];
    if (typeof prop === 'undefined' || typeof prop === 'function' || typeof prop === 'symbol') {
      return;
    }
    serializedProps.push(`${JSON.stringify(key)}:${stableSerialize(prop, seen)}`);
  });

  seen.delete(value);
  return `{${serializedProps.join(',')}}`;
};

const fnv1a32 = (input) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const stableHash = (obj) => {
  const serialized = stableSerialize(obj);
  return fnv1a32(serialized);
};
