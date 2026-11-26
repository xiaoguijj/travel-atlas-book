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
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.6" cy="9.4" r="1.6" />
      <path d="m4 16.6 4.7-4.3a1.6 1.6 0 0 1 2.2 0l3.2 3" />
      <path d="m12.6 15.4 1.7-1.6a1.6 1.6 0 0 1 2.2 0l3.3 3.1" />
    </Icon>
  );
}

export function StampIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7.5a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5z" />
      <path d="M8 6v-1.4M12 6v-1.4M16 6v-1.4M8 19.4V18M12 19.4V18M16 19.4V18M6 8.5H4.6M6 12H4.6M6 15.5H4.6M19.4 8.5H18M19.4 12H18M19.4 15.5H18" />
      <path d="M9.5 10.2h5v3.6h-5z" />
    </Icon>
  );
}

export function StickerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5c0-.6-.06-1.2-.18-1.76L15 10.2 13.3 4.1A8.6 8.6 0 0 0 12 3.5z" />
      <path d="M13.3 4.1 15 10.2l5.32.04A8.55 8.55 0 0 0 13.3 4.1z" />
      <circle cx="9.2" cy="11" r=".9" />
      <circle cx="13.6" cy="13.4" r=".9" />
      <path d="M9.4 16.2c1.1 1 3.1 1.1 4.3.2" />
    </Icon>
  );
}

export function TextIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />
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
