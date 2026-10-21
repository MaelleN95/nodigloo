export function IglooIllustration() {
  return (
    <svg
      className="igloo-illustration"
      viewBox="0 0 300 210"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="igloo-door" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0c566" />
          <stop offset="1" stopColor="#c98f35" />
        </linearGradient>
        <radialGradient id="igloo-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e3b253" stopOpacity="0.45" />
          <stop offset="1" stopColor="#e3b253" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="105" r="100" fill="#1b303c" />
      <ellipse cx="150" cy="150" rx="100" ry="66" fill="url(#igloo-glow)" />
      <g fill="#e3b253">
        <circle cx="62" cy="48" r="2" />
        <circle cx="236" cy="40" r="2.5" />
        <circle cx="212" cy="74" r="1.5" />
      </g>
      <path d="M104 180 A46 46 0 0 1 196 180 Z" fill="#14232d" />
      <g fill="none" strokeWidth="44">
        <path d="M60.03 177.64 A90 90 0 0 1 70.53 137.75" stroke="#2c4658" />
        <path d="M71.67 135.68 A90 90 0 0 1 139.03 90.67" stroke="#3a566a" />
        <path d="M145.29 90.12 A90 90 0 0 1 189.45 99.11" stroke="#b8d0dc" />
        <path d="M193.63 101.29 A90 90 0 0 1 223.72 128.38" stroke="#8aa9ba" />
        <path d="M226.32 132.31 A90 90 0 0 1 239.97 177.64" stroke="#6f93a7" />
      </g>
      <path
        d="M120 180 V152 A30 30 0 0 1 180 152 V180 Z"
        fill="url(#igloo-door)"
      />
      <rect x="30" y="180" width="240" height="8" rx="4" fill="#e9eef0" />
      <ellipse cx="150" cy="196" rx="34" ry="4" fill="#e3b253" opacity="0.35" />
    </svg>
  );
}
