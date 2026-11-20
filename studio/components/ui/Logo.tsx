export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#1b1e25" stroke="#30343d" />
      <rect x="7" y="8" width="8" height="16" rx="2" fill="#46c4bc" />
      <rect x="17" y="8" width="8" height="7" rx="2" fill="#f5f5f6" />
      <rect x="17" y="17" width="8" height="7" rx="2" fill="#30343d" />
    </svg>
  );
}
