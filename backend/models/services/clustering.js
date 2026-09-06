function clusterAddresses(transactions) {
  const parent = new Map();

  function find(addr) {
    if (!parent.has(addr)) parent.set(addr, addr);
    if (parent.get(addr) !== addr) parent.set(addr, find(parent.get(addr)));
    return parent.get(addr);
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const tx of transactions) {
    const inputs = tx.inputAddresses || [];
    for (let i = 1; i < inputs.length; i++) {
      union(inputs[0], inputs[i]);
    }
  }

  const clusters = new Map();
  for (const addr of parent.keys()) {
    const root = find(addr);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(addr);
  }

  return Array.from(clusters.entries()).map(([root, members], idx) => ({
    clusterId: `CLU-${String(idx + 1).padStart(4, '0')}`,
    root,
    members
  }));
}

module.exports = { clusterAddresses };