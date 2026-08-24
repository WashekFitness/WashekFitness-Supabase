import { useRef, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const THRESHOLD = 72;

export default function PullToRefresh({ queryKeys = [], children }) {
  const queryClient = useQueryClient();
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pullYRef = useRef(0);
  const refreshingRef = useRef(false);
  const queryKeysRef = useRef(queryKeys);
  const wrapperRef = useRef(null);

  queryKeysRef.current = queryKeys;

  useEffect(() => {
    // Find the nearest scrollable ancestor (AppLayout's scroll container)
    // instead of creating our own — nested scroll containers cause mobile jank.
    let scroller = wrapperRef.current?.parentElement;
    while (scroller) {
      const style = getComputedStyle(scroller);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') break;
      scroller = scroller.parentElement;
    }
    if (!scroller) scroller = document.documentElement;

    const onTouchStart = (e) => {
      if (scroller.scrollTop === 0) startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current === null || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && scroller.scrollTop === 0) {
        e.preventDefault();
        const next = Math.min(delta * 0.5, THRESHOLD + 20);
        pullYRef.current = next;
        setPullY(next);
      }
    };

    const onTouchEnd = async () => {
      if (pullYRef.current >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        pullYRef.current = 0;
        setPullY(0);
        await Promise.all(
          queryKeysRef.current.map(key => queryClient.invalidateQueries({ queryKey: key }))
        );
        refreshingRef.current = false;
        setRefreshing(false);
      } else {
        pullYRef.current = 0;
        setPullY(0);
      }
      startY.current = null;
    };

    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd);
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
    };
  }, [queryClient]);

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div ref={wrapperRef}>
      <div
        className="flex items-center justify-center transition-all duration-200 overflow-hidden"
        style={{ height: refreshing ? 48 : pullY > 0 ? pullY : 0 }}
      >
        <RefreshCw
          className={cn('w-5 h-5 text-primary transition-all', refreshing && 'animate-spin')}
          style={{ opacity: refreshing ? 1 : progress, transform: `rotate(${progress * 180}deg)` }}
        />
      </div>
      {children}
    </div>
  );
}