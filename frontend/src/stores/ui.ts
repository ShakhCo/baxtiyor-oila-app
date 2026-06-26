import { useEffect } from 'react';
import { create } from 'zustand';

// Ref-counted set of open overlay sheets. The bottom nav hides itself while any
// sheet is up (a fixed tab bar otherwise sits on top of a bottom sheet) and
// reappears when the last one closes.
type UiState = {
  openSheets: number;
  acquire: () => void;
  release: () => void;
};

const useUiStore = create<UiState>((set) => ({
  openSheets: 0,
  acquire: () => set((s) => ({ openSheets: s.openSheets + 1 })),
  release: () => set((s) => ({ openSheets: Math.max(0, s.openSheets - 1) })),
}));

/** True while any sheet is open — used by the bottom nav to hide itself. */
export const useSheetOpen = (): boolean => useUiStore((s) => s.openSheets > 0);

/**
 * Hide the bottom nav while a sheet is open. Pass the sheet's open flag; for a
 * component that's only mounted when open, the default (true) registers it for
 * its whole lifetime.
 */
export function useHideBottomNav(active = true): void {
  const acquire = useUiStore((s) => s.acquire);
  const release = useUiStore((s) => s.release);
  useEffect(() => {
    if (!active) return;
    acquire();
    return release;
  }, [active, acquire, release]);
}
