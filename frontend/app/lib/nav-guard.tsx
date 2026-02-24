'use client';

import { createContext, useContext, useMemo, useRef } from 'react';

// proceed(true)  → allow navigation
// proceed(false) → block / stay on page
type ProceedFn = (allow: boolean) => void;
type GuardFn   = (proceed: ProceedFn) => void;

interface NavGuardCtx {
  setGuard: (fn: GuardFn | null) => void;
  runGuard: (onAllowed: () => void) => void;
}

const NavGuardContext = createContext<NavGuardCtx>({
  setGuard: () => {},
  runGuard: (fn) => fn(),
});

export function NavGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<GuardFn | null>(null);

  // Stable object — guardRef never changes identity
  const value = useMemo<NavGuardCtx>(() => ({
    setGuard: (fn) => { guardRef.current = fn; },
    runGuard: (onAllowed) => {
      if (!guardRef.current) { onAllowed(); return; }
      guardRef.current((allow) => { if (allow) onAllowed(); });
    },
  }), []);

  return <NavGuardContext.Provider value={value}>{children}</NavGuardContext.Provider>;
}

export const useNavGuard = () => useContext(NavGuardContext);
