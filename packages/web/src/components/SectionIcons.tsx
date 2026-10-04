import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const attrs = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function DeliveredIcon(props: IconProps) {
  return <svg {...attrs} {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></svg>;
}

export function ShieldCheckIcon(props: IconProps) {
  return <svg {...attrs} {...props}><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>;
}

export function ListChecksIcon(props: IconProps) {
  return <svg {...attrs} {...props}><path d="m3.5 6.5 1.5 1.5 2.5-3" /><path d="M10 6.5h10" /><path d="m3.5 12 1.5 1.5 2.5-3" /><path d="M10 12h10" /><path d="m3.5 17.5 1.5 1.5 2.5-3" /><path d="M10 17.5h10" /></svg>;
}

export function MiniIcon(props: IconProps) {
  return <svg {...attrs} {...props}><circle cx="12" cy="12" r="9" /><path d="M7.5 16V8l4.5 5 4.5-5v8" /></svg>;
}

export function BlocksIcon(props: IconProps) {
  return <svg {...attrs} {...props}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12.1V21" /><path d="m8 5.3 8 4.5" /></svg>;
}

export function SparklesIcon(props: IconProps) {
  return <svg {...attrs} {...props}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></svg>;
}

export function LockIcon(props: IconProps) {
  return <svg {...attrs} {...props}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg>;
}

export function NetworkIcon(props: IconProps) {
  return <svg {...attrs} {...props}><circle cx="12" cy="5" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" /><path d="m10.8 6.8-4.6 9.4m7-9.4 4.6 9.4M7 18h10" /></svg>;
}
