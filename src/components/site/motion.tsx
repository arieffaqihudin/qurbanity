import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight motion layer (no animation library):
 * - One shared, rAF-throttled scroll listener drives every parallax layer by writing a CSS
 *   transform directly to the element — no React state updates on scroll.
 * - One shared IntersectionObserver reveals elements once.
 * - prefers-reduced-motion disables both; intensity is scaled down on tablet and phone.
 */

type Layer = { el: HTMLElement | SVGElement; speed: number };
const layers = new Set<Layer>();
let ticking = false;
let listening = false;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const intensity = () => (window.innerWidth < 768 ? 0.35 : window.innerWidth < 1024 ? 0.6 : 1);

function update() {
  ticking = false;
  const vh = window.innerHeight;
  const k = intensity();
  layers.forEach(({ el, speed }) => {
    const host = (el.parentElement ?? el).getBoundingClientRect();
    if (host.bottom < -200 || host.top > vh + 200) return; // off-screen: skip work
    // 0 when the host's centre sits at the viewport centre.
    const offset = (host.top + host.height / 2 - vh / 2) * speed * k;
    el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
  });
}
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

function register(layer: Layer) {
  layers.add(layer);
  if (!listening) {
    listening = true;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }
  onScroll();
  return () => {
    layers.delete(layer);
    layer.el.style.transform = "";
    if (!layers.size && listening) {
      listening = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }
  };
}

/** Moves the element vertically relative to its parent while scrolling. Negative speed = moves against the scroll. */
export function useParallax<T extends HTMLElement | SVGElement>(speed: number) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    return register({ el, speed });
  }, [speed]);
  return ref;
}

export function ParallaxLayer({ speed, className, style, children, as: Tag = "div" }: { speed: number; className?: string; style?: CSSProperties; children?: ReactNode; as?: ElementType }) {
  const ref = useParallax<HTMLElement>(speed);
  return <Tag ref={ref} aria-hidden className={cn("pointer-events-none will-change-transform", className)} style={style}>{children}</Tag>;
}

/** Full-bleed image that drifts slower than the page. Oversized vertically so edges never show. */
export function ParallaxImage({ src, alt = "", speed = 0.18, className, imgClassName, eager }: { src: string; alt?: string; speed?: number; className?: string; imgClassName?: string; eager?: boolean }) {
  const ref = useParallax<HTMLImageElement>(speed);
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <img ref={ref} src={src} alt={alt} width={1600} height={1000} loading={eager ? "eager" : "lazy"} decoding="async"
        className={cn("absolute inset-x-0 -top-[12%] h-[124%] w-full object-cover will-change-transform", imgClassName)} />
    </div>
  );
}

// ---------- Reveal ----------
let io: IntersectionObserver | null = null;
function observer() {
  io ??= new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add("is-visible"); io!.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -5% 0px", threshold: 0.05 });
  return io;
}

/**
 * Fades/slides content in once when it enters the viewport. Content is fully visible without JS
 * and with reduced motion (the hidden state only applies under html.motion-ready).
 */
export function Reveal({ children, className, delay = 0, variant = "up", as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; variant?: "up" | "scale" | "fade"; as?: ElementType }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) { el.classList.add("is-visible"); return; }
    document.documentElement.classList.add("motion-ready");
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add("is-visible"); return; } // already on screen: no flash
    observer().observe(el);
    return () => io?.unobserve(el);
  }, []);
  return <Tag ref={ref} data-reveal={variant} className={className} style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}>{children}</Tag>;
}
