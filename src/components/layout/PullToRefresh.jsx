import { useRef, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const THRESHOLD = 72;
const ACTIVATION_DISTANCE = 8;

/*
 * Elements that should always receive normal mobile touch/click
 * behavior instead of being interpreted as the beginning of a
 * pull-to-refresh gesture.
 */
function isInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        'button',
        'a',
        'input',
        'textarea',
        'select',
        'option',
        '[role="button"]',
        '[role="tab"]',
        '[contenteditable="true"]',
      ].join(',')
    )
  );
}

export default function PullToRefresh({
  queryKeys = [],
  children,
}) {
  const queryClient = useQueryClient();

  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef(null);
  const pullYRef = useRef(0);
  const refreshingRef = useRef(false);
  const queryKeysRef = useRef(queryKeys);

  const wrapperRef = useRef(null);

  /*
   * Once a touch begins on an interactive element, completely
   * ignore that gesture for pull-to-refresh.
   *
   * This is especially important for mobile buttons and links.
   */
  const interactiveTouchRef = useRef(false);

  /*
   * Pull-to-refresh should not take over the gesture until the
   * finger has actually moved enough to indicate a pull.
   */
  const pullingRef = useRef(false);

  queryKeysRef.current = queryKeys;

  useEffect(() => {
    /*
     * Find the nearest scrollable ancestor (AppLayout's scroll
     * container) instead of creating another scroll container.
     *
     * This preserves the existing mobile scrolling behavior.
     */
    let scroller =
      wrapperRef.current?.parentElement;

    while (scroller) {
      const style = getComputedStyle(scroller);

      if (
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll'
      ) {
        break;
      }

      scroller = scroller.parentElement;
    }

    if (!scroller) {
      scroller = document.documentElement;
    }

    const onTouchStart = (e) => {
      if (
        refreshingRef.current ||
        !e.touches?.length
      ) {
        return;
      }

      /*
       * Never interfere with buttons, links, form controls,
       * tabs, or other interactive elements.
       *
       * This is the key mobile fix.
       */
      interactiveTouchRef.current =
        isInteractiveTarget(e.target);

      pullingRef.current = false;
      pullYRef.current = 0;
      setPullY(0);

      if (
        interactiveTouchRef.current
      ) {
        startY.current = null;
        return;
      }

      /*
       * Pull-to-refresh can only begin when the page is already
       * at the very top, just like before.
       */
      if (scroller.scrollTop === 0) {
        startY.current =
          e.touches[0].clientY;
      } else {
        startY.current = null;
      }
    };

    const onTouchMove = (e) => {
      if (
        startY.current === null ||
        interactiveTouchRef.current ||
        refreshingRef.current ||
        !e.touches?.length
      ) {
        return;
      }

      const delta =
        e.touches[0].clientY -
        startY.current;

      /*
       * Only respond to a downward movement.
       */
      if (
        delta <= 0 ||
        scroller.scrollTop !== 0
      ) {
        return;
      }

      /*
       * Ignore tiny natural finger movement during a tap.
       * This prevents mobile taps from accidentally becoming
       * pull-to-refresh gestures.
       */
      if (
        !pullingRef.current &&
        delta < ACTIVATION_DISTANCE
      ) {
        return;
      }

      pullingRef.current = true;

      /*
       * Once the gesture is clearly a pull, prevent the page
       * from scrolling underneath the refresh indicator.
       */
      e.preventDefault();

      const next = Math.min(
        delta * 0.5,
        THRESHOLD + 20
      );

      pullYRef.current = next;
      setPullY(next);
    };

    const onTouchEnd = async () => {
      if (
        refreshingRef.current
      ) {
        return;
      }

      /*
       * Interactive touches never participate in
       * pull-to-refresh.
       */
      if (
        interactiveTouchRef.current
      ) {
        interactiveTouchRef.current = false;
        pullingRef.current = false;
        startY.current = null;
        pullYRef.current = 0;
        setPullY(0);
        return;
      }

      if (
        pullingRef.current &&
        pullYRef.current >= THRESHOLD
      ) {
        refreshingRef.current = true;
        setRefreshing(true);

        pullYRef.current = 0;
        setPullY(0);

        try {
          await Promise.all(
            queryKeysRef.current.map(
              (key) =>
                queryClient.invalidateQueries({
                  queryKey: key,
                })
            )
          );
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      } else {
        pullYRef.current = 0;
        setPullY(0);
      }

      pullingRef.current = false;
      interactiveTouchRef.current = false;
      startY.current = null;
    };

    const onTouchCancel = () => {
      startY.current = null;
      pullYRef.current = 0;
      pullingRef.current = false;
      interactiveTouchRef.current = false;
      setPullY(0);
    };

    scroller.addEventListener(
      'touchstart',
      onTouchStart,
      { passive: true }
    );

    scroller.addEventListener(
      'touchmove',
      onTouchMove,
      { passive: false }
    );

    scroller.addEventListener(
      'touchend',
      onTouchEnd
    );

    scroller.addEventListener(
      'touchcancel',
      onTouchCancel
    );

    return () => {
      scroller.removeEventListener(
        'touchstart',
        onTouchStart
      );

      scroller.removeEventListener(
        'touchmove',
        onTouchMove
      );

      scroller.removeEventListener(
        'touchend',
        onTouchEnd
      );

      scroller.removeEventListener(
        'touchcancel',
        onTouchCancel
      );
    };
  }, [queryClient]);

  const progress = Math.min(
    pullY / THRESHOLD,
    1
  );

  return (
    <div ref={wrapperRef}>
      <div
        className="flex items-center justify-center transition-all duration-200 overflow-hidden"
        style={{
          height:
            refreshing
              ? 48
              : pullY > 0
                ? pullY
                : 0,
        }}
      >
        <RefreshCw
          className={cn(
            'w-5 h-5 text-primary transition-all',
            refreshing && 'animate-spin'
          )}
          style={{
            opacity:
              refreshing
                ? 1
                : progress,
            transform: `rotate(${
              progress * 180
            }deg)`,
          }}
        />
      </div>

      {children}
    </div>
  );
}
