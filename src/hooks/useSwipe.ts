import { useRef, useCallback } from 'react';

interface UseSwipeOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  threshold?: number;
}

export function useSwipe({ onSwipeRight, onSwipeLeft, threshold = 50 }: UseSwipeOptions) {
  const startX = useRef(0);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - startX.current;
      const deltaY = Math.abs(endY - startY.current);

      if (deltaY < Math.abs(deltaX) && Math.abs(deltaX) > threshold) {
        if (deltaX > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      }
    },
    [onSwipeRight, onSwipeLeft, threshold]
  );

  return { onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd };
}
