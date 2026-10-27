import { lazy, Suspense, useState } from 'react';
import { TopBar } from '@/ui/TopBar';
import { LeftPanel } from '@/ui/LeftPanel';
import { RightPanel } from '@/ui/RightPanel';
import { BottomBar } from '@/ui/BottomBar';
import { Viewport } from '@/ui/Viewport';
import { useApp } from '@/state/store';

const Comparator = lazy(() => import('@/ui/Comparator'));

export default function App() {
  const [hideLeft, setHideLeft] = useState(false);
  const [hideRight, setHideRight] = useState(false);
  const showComparator = useApp((s) => s.showComparator);
  const cls = ['app', hideLeft && 'collapsed-left', hideRight && 'collapsed-right', !hideLeft && 'show-left', !hideRight && 'show-right'].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <TopBar onToggleLeft={() => setHideLeft((v) => !v)} onToggleRight={() => setHideRight((v) => !v)} />
      <LeftPanel />
      <Viewport />
      <RightPanel />
      <BottomBar />
      {showComparator && (
        <Suspense fallback={null}>
          <Comparator />
        </Suspense>
      )}
    </div>
  );
}
