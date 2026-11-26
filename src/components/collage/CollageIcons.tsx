import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PhotoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <rect x="5.8" y="6.8" width="12.4" height="9.2" rx="1" strokeWidth="1.2" opacity="0.6" />
      <circle cx="9.2" cy="9.8" r="1.3" />
      <path d="m5.8 15 3.6-3.4a1.2 1.2 0 0 1 1.7 0l2.2 2.1" />
      <path d="m12.3 13.7 1.3-1.2a1.2 1.2 0 0 1 1.7 0l2.8 2.6" />
    </Icon>
  );
}

export function StampIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7.5a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5z" />
      <path d="M8 6v-1.4M12 6v-1.4M16 6v-1.4M8 19.4V18M12 19.4V18M16 19.4V18M6 8.5H4.6M6 12H4.6M6 15.5H4.6M19.4 8.5H18M19.4 12H18M19.4 15.5H18" />
      <path d="M8.5 14.5h7M9.6 14.5v-3.2a2.4 2.4 0 0 1 4.8 0v3.2" />
      <path d="M12 7.8v1.1" />
    </Icon>
  );
}

export function StickerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.8c1.4 0 2.5.4 3.5 1.1l3.6 3.6c.7 1 1.1 2.1 1.1 3.5a8.2 8.2 0 1 1-8.2-8.2z" />
      <path d="M15.2 4.8v4a1.2 1.2 0 0 0 1.2 1.2h4" />
      <path d="M11 9.6c-1.8 1.2-2.6 3-2.2 5 2 .4 3.8-.4 5-2.2" />
      <path d="M8.6 14.8c1-1.2 2.1-2.3 3.4-3.4" />
    </Icon>
  );
}

export function TextIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 7V5.2h13V7" />
      <path d="M12 5.2v13.6" />
      <path d="M9 18.8h6" />
      <path d="M5.5 5.2 6.8 6.5M18.5 5.2 17.2 6.5" strokeWidth="1.3" />
    </Icon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3.8 8 4.2-8 4.2-8-4.2z" />
      <path d="m4 12.2 8 4.2 8-4.2" />
      <path d="m4 16.2 8 4.2 8-4.2" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15M9.5 6.5V4.8h5v1.7M7 6.5l.9 13.2h8.2L17 6.5" />
      <path d="M10.2 10v6.2M13.8 10v6.2" />
    </Icon>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
    </Icon>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />
    </Icon>
  );
}

export function ToTopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4h14M12 20V9M7 13.5 12 8.5l5 5" />
    </Icon>
  );
}

export function ToBottomIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 20h14M12 4v11M7 10.5 12 15.5l5-5" />
    </Icon>
  );
}

export function FitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
    </Icon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </Icon>
  );
}

export function RotateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.8 12a7.2 7.2 0 1 0 2.1-5.1" />
      <path d="M4.4 4.6v4.2h4.2" />
    </Icon>
  );
}

export function ScaleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 15.5v2.6a1.4 1.4 0 0 0 1.4 1.4h12.2a1.4 1.4 0 0 0 1.4-1.4v-2.6" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}
