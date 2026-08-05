export const walletAccountMenuText = {
  "zh-CN": "切换账户",
  en: "Switch account",
} as const;

export function AccountSwitchMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}>
      <svg
        className="icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="3" />
        <path d="M3 18c1-2.5 2.8-4 5-4s4 1.5 5 4" />
        <path d="M14 5h5" />
        <path d="m17 2 2 3-2 3" />
        <path d="M14 18h5" />
        <path d="m17 15 2 3-2 3" />
      </svg>
      {label}
    </button>
  );
}
