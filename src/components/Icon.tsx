import type { CSSProperties, ReactNode } from 'react';
export type IconName = 'arrow' | 'bag' | 'heart' | 'search' | 'close' | 'calendar' | 'pin' | 'check' | 'plus' | 'minus' | 'sliders' | 'card' | 'vase' | 'flower';
export default function Icon({ name, size = 20, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M4 12h16M13 5l7 7-7 7" /></>,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    sliders: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="currentColor" /><circle cx="15" cy="17" r="2" fill="currentColor" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 5 9 8 9-8M7 16h3" /></>,
    vase: <><path d="M8 9h8l2 10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L8 9Z" /><path d="M10 9 8 3M14 9l2-7M12 9V3" /></>,
    flower: <><circle cx="12" cy="10" r="2" /><path d="M12 8c-5-7-9 0-2 3-8 1-5 8 1 2-1 8 7 7 3 0 7 3 9-5 1-4 5-6-3-9-3-1ZM12 14v8M12 19l5-3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}
