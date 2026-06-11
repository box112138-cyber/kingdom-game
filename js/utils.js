// Seeded pseudo-random number generator (Lehmer RNG)
export function srand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Deterministic random per cell using three offset-based seeds
export function genRand(r, c, offset) {
  const seeds = [7919, 3821, 5573];
  const mults = [6271, 9199, 2801];
  return srand(r * seeds[offset] + c * mults[offset] + 42 * 104729)();
}

// Format number for display
export function rf(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return Math.floor(n).toLocaleString();
  return Math.floor(n).toString();
}
