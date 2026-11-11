import { Speaker } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router';
import { ContextMenuHost } from '../components/ContextMenu';
import { ScrollArea } from '../components/ScrollArea';
import { Toaster } from '../components/Toaster';
import { selectRemoteDeviceName, usePlayer } from '../player/store';
import { usePlayerSync } from '../player/sync';
import { useIsMobileLayout, useMediaQuery } from '../lib/useMediaQuery';
import { MobileLayout } from './MobileLayout';
import {
  LEFT_COLLAPSED,
  LEFT_MAX,
  LEFT_MIN,
  PANEL_GAP,
  RIGHT_MAX,
  RIGHT_MIN,
  useLayout,
} from '../store/layout';
import { LibrarySidebar } from './LibrarySidebar';
import { MainScrollContext, useResetScrollOnNavigate } from './mainScroll';
import { PlayerBar } from './PlayerBar';
import { Resizer } from './Resizer';
import { RightPanel } from './RightPanel';
import { TopBar } from './TopBar';
import { useShortcuts } from './useShortcuts';

/**
 * Desktop shell (UI-SPEC §1.1): one grid on black, panels as 8px-rounded cards with an
 * 8px gap.
 *   "nav    nav  nav"
 *   "left   main right"   (1fr)
 *   "player player player"
 * Row heights: 48px top bar, 72px player bar (spec §1.2 / §1.6).
 */
export function AppShell() {
  // Always-on, whichever layout is showing (the SDK player must survive layout switches).
  useShortcuts();
  usePlayerSync();
  const mobile = useIsMobileLayout();
  return (
    <>
      {mobile ? <MobileLayout /> : <DesktopLayout />}
      <Toaster />
      <ContextMenuHost />
    </>
  );
}

function DesktopLayout() {
  const { leftWidth, leftCollapsed, rightOpen, rightWidth, resizeLeft, resizeRight } = useLayout();
  const [dragging, setDragging] = useState(false);
  // When another device is playing, a 24px accent strip names it (spec §1.5 observed a
  // 24px "--bottom-bar-height" variant under the player bar).
  const remoteDevice = usePlayer(selectRemoteDeviceName);

  // The main panel's scroller, shared with pages (sticky headers, infinite loading).
  const [mainScroll, setMainScroll] = useState<HTMLDivElement | null>(null);
  useResetScrollOnNavigate(mainScroll);

  // Chosen: from 768px to 899px wide there is no room for both panels, so the library
  // auto-collapses to the rail and the right panel hides (persisted prefs are untouched).
  // Below 768px the MobileLayout is used instead.
  const narrow = useMediaQuery('(max-width: 899px)');
  const collapsed = leftCollapsed || narrow;
  const showRight = rightOpen && !narrow;
  const leftPx = collapsed ? LEFT_COLLAPSED : leftWidth;

  return (
    <div
      className="grid h-full min-w-[640px] overflow-hidden bg-app"
      style={{
        gap: PANEL_GAP,
        padding: PANEL_GAP,
        gridTemplateRows: `48px minmax(0, 1fr) 72px${remoteDevice ? ' 24px' : ''}`,
        gridTemplateColumns: showRight
          ? `${leftPx}px minmax(0, 1fr) ${rightWidth}px`
          : `${leftPx}px minmax(0, 1fr)`,
        gridTemplateAreas:
          (showRight
            ? '"nav nav nav" "left main right" "player player player"'
            : '"nav nav" "left main" "player player"') +
          (remoteDevice ? (showRight ? ' "device device device"' : ' "device device"') : ''),
        // Animate collapse/expand, but follow the pointer 1:1 while dragging.
        transition: dragging ? 'none' : 'grid-template-columns 300ms var(--ease-productive)',
      }}
    >
      <TopBar />

      <div
        className="relative min-h-0 rounded-lg bg-surface outline -outline-offset-1 outline-panel-border"
        style={{ gridArea: 'left', viewTransitionName: 'left-sidebar' }}
      >
        <LibrarySidebar collapsed={collapsed} />
        {!narrow && (
          <Resizer
            edge="end"
            label="Resize library"
            width={leftPx}
            min={LEFT_MIN}
            max={LEFT_MAX}
            onResize={resizeLeft}
            onDragChange={setDragging}
          />
        )}
      </div>

      <main
        id="main"
        tabIndex={-1}
        className="relative min-h-0 min-w-0 overflow-hidden rounded-lg bg-surface outline -outline-offset-1 outline-panel-border"
        style={{ gridArea: 'main' }}
      >
        <ScrollArea className="h-full" viewportClassName="scroll-smooth" viewportRef={setMainScroll}>
          <MainScrollContext.Provider value={mainScroll}>
            <Outlet />
          </MainScrollContext.Provider>
        </ScrollArea>
      </main>

      {showRight && (
        <div
          className="relative min-h-0 rounded-lg bg-surface outline -outline-offset-1 outline-panel-border"
          style={{ gridArea: 'right', viewTransitionName: 'right-panel' }}
        >
          <Resizer
            edge="start"
            label="Resize now playing view"
            width={rightWidth}
            min={RIGHT_MIN}
            max={RIGHT_MAX}
            onResize={resizeRight}
            onDragChange={setDragging}
          />
          <RightPanel />
        </div>
      )}

      <PlayerBar />

      {remoteDevice && (
        <div
          style={{ gridArea: 'device' }}
          className="-mx-2 -mb-2 flex items-center justify-end gap-2 bg-accent px-6 text-sm font-bold text-on-accent"
        >
          <Speaker className="size-4" aria-hidden />
          Playing on {remoteDevice}
        </div>
      )}
    </div>
  );
}
