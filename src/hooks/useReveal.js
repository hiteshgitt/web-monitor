import { useEffect, useRef, useState } from 'react';

// Becomes true once the element scrolls into view (used for entrance animations)
const useReveal = (threshold = 0.15) => {
  const ref = useRef(null);
  // Without IntersectionObserver (very old browsers) just show everything
  const [visible, setVisible] = useState(() => !('IntersectionObserver' in window));

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, visible]);

  return [ref, visible];
};

export default useReveal;
