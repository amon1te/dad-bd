import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti(enabled: boolean = true) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!enabled || hasRun.current) return;
    hasRun.current = true;

    // Delay to let page render first
    const timeout = setTimeout(() => {
      // First burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#d97706', '#fbbf24', '#f59e0b', '#92400e', '#b45309'],
      });

      // Second burst slightly delayed
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#d97706', '#fbbf24', '#f59e0b', '#92400e', '#b45309'],
        });
      }, 200);

      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#d97706', '#fbbf24', '#f59e0b', '#92400e', '#b45309'],
        });
      }, 400);
    }, 500);

    return () => clearTimeout(timeout);
  }, [enabled]);
}
