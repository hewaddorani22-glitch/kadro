import { useEffect, useState } from 'react';
const locks = new Set<symbol>();
const listeners = new Set<() => void>();
function changed() { listeners.forEach(fn => fn()); }
export function presentationIsIdle() { return locks.size === 0; }
export function holdPresentation() {
  const key = Symbol(); locks.add(key); changed();
  return () => { locks.delete(key); changed(); };
}
export function usePresentationBlock(blocked: boolean) {
  useEffect(() => { if (blocked) return holdPresentation(); }, [blocked]);
}
export function usePresentationIdle() {
  const [idle, setIdle] = useState(presentationIsIdle);
  useEffect(() => { const listener = () => setIdle(presentationIsIdle()); listeners.add(listener); listener(); return () => { listeners.delete(listener); }; }, []);
  return idle;
}
