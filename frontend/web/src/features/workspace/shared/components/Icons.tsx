import type { SVGProps } from "react";

export function IconSend(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M5 12h13m0 0-4-4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSave(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" {...props}>
      <path
        d="M7 5h7l3 3v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path d="M14 5v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

export function IconCopy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" {...props}>
      <path
        d="M8 8h8v10H8V8Zm-2 8V6a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function IconFeedback(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" {...props}>
      <path
        d="M7 10h10v7H7v-7Zm2-3h6v3H9V7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function IconFullscreen(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M7 9V7h2M17 9V7h-2M7 15v2h2M17 15v2h-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function IconExitFullscreen(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M9 7v2H7M15 7v2h2M9 17v-2H7M15 17v-2h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M7 7l10 10M17 7L7 17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function IconExpand(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
