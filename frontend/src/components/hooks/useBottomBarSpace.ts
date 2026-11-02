import { useCallback } from "react";

export const BOTTOM_BAR_HEIGHT_VAR = "--bottom-bar-height";
export const BOTTOM_BAR_SPACE = `var(${BOTTOM_BAR_HEIGHT_VAR}, 0px)`;

// Heights of all mounted bars; the tallest one defines the reserved space.
const barHeights = new Map<Element, number>();

const publish = () => {
  const root = document.documentElement;
  const height = Math.max(0, ...barHeights.values());
  if (height > 0) root.style.setProperty(BOTTOM_BAR_HEIGHT_VAR, `${height}px`);
  else root.style.removeProperty(BOTTOM_BAR_HEIGHT_VAR);
};

/**
 * Publishes the height of a fixed bottom bar as `--bottom-bar-height` on <html> while it is
 * mounted, so the footer and the page content can leave room for it. Bars that are not
 * `position: fixed` at the current width (e.g. only fixed on mobile) report 0.
 * Use as a ref: `<Bar ref={useBottomBarSpace()} />`. Works for conditionally rendered bars.
 */
export default function useBottomBarSpace<T extends HTMLElement>() {
  return useCallback((el: T | null) => {
    if (!el) return;
    const update = () => {
      const isFixed = getComputedStyle(el).position === "fixed";
      barHeights.set(el, isFixed ? el.getBoundingClientRect().height : 0);
      publish();
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      barHeights.delete(el);
      publish();
    };
  }, []);
}
