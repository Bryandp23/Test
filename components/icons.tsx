// Icônes des calendriers (formes simplifiées reconnaissables) et pictogrammes d'interface.
// Toutes décoratives : le libellé texte voisin porte le sens (aria-hidden).
type P = { className?: string };

export function GoogleCalendarIcon({ className = "size-9" }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="6" y="6" width="36" height="36" rx="4" fill="#fff" />
      <path d="M34 6h4a4 4 0 0 1 4 4v4h-8z" fill="#1967D2" />
      <path d="M6 34v4a4 4 0 0 0 4 4h4v-8z" fill="#188038" />
      <path d="M34 34h8l-8 8z" fill="#EA4335" />
      <path d="M14 6h20v8H14z" fill="#4285F4" />
      <path d="M6 14h8v20H6z" fill="#FBBC04" />
      <path d="M14 42h20v-8H14z" fill="#34A853" />
      <path d="M42 14h-8v20h8z" fill="#4285F4" />
      <path d="M10 6h4v8H6v-4a4 4 0 0 1 4-4z" fill="#1A73E8" />
      <text x="24" y="30.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="13" fill="#1A73E8">31</text>
    </svg>
  );
}

export function OutlookIcon({ className = "size-9" }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="18" y="8" width="24" height="32" rx="3" fill="#0A64C8" />
      <path d="M18 22h24v15a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3z" fill="#28A8EA" />
      <path d="M18 22l12 8 12-8" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" />
      <rect x="5" y="13" width="22" height="22" rx="3" fill="#0F4C9E" />
      <ellipse cx="16" cy="24" rx="5.6" ry="6.6" fill="none" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

export function AppleIcon({ className = "size-9" }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="9" fill="#fff" stroke="#d4d8dd" />
      <g transform="translate(12 11) scale(1)">
        <path
          fill="#111"
          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        />
      </g>
    </svg>
  );
}

export function YahooIcon({ className = "size-9" }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="4" y="4" width="40" height="40" rx="9" fill="#6001D2" />
      <text x="23" y="31" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="17" fill="#fff">
        Y!
      </text>
    </svg>
  );
}

export function FileCalendarIcon({ className = "size-9" }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="6" y="9" width="36" height="33" rx="5" fill="#effaf9" stroke="#1d7a75" strokeWidth="2.5" />
      <path d="M6 18h36" stroke="#1d7a75" strokeWidth="2.5" />
      <path d="M15 5v8M33 5v8" stroke="#1d7a75" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M17 29h14M24 22v14" stroke="#27958f" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconCalendar({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
export function IconClock({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
export function IconPin({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
export function IconVideo({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </svg>
  );
}
export function IconCheck({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
export function IconInfo({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </svg>
  );
}
export function IconWarn({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.5" />
    </svg>
  );
}
export function IconChevron({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
export function IconExternal({ className = "size-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
export function IconCopy({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  );
}
export function IconPlus({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function IconTrash({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}
export function IconX({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
export function IconSearch({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
export function IconLink({ className = "size-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}

export function EphecLogo({ className = "h-9", src, decorative }: P & { src?: string; decorative?: boolean }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={decorative ? "" : "EPHEC"} className={className} />;
  }
  return (
    <svg viewBox="0 0 150 40" className={className} {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "EPHEC" })}>
      <path d="M2 2h30a8 8 0 0 1 8 8v28H12A10 10 0 0 1 2 28z" fill="#27958F" />
      <path d="M11 12h18M11 20h13M11 28h18" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <text x="48" y="29" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="25" letterSpacing="1.5" fill="#13201f">
        EPHEC
      </text>
    </svg>
  );
}
