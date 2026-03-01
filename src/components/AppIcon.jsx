const ICON_PATHS = {
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v6h8V4" />
      <path d="M9 20v-5h6v5" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 10v7" />
      <path d="M14 10v7" />
    </>
  ),
  details: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 12h8" />
      <path d="M8 15h5" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  csv: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M15 3v4h4" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h4" />
    </>
  ),
  pdf: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M15 3v4h4" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h5" />
    </>
  ),
  map: (
    <>
      <path d="m3 7 6-3 6 3 6-3v13l-6 3-6-3-6 3z" />
      <path d="M9 4v13" />
      <path d="M15 7v13" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h3l2 3h3l2 3" />
      <path d="M6 8v3l3 2v3" />
    </>
  ),
  reset: (
    <>
      <path d="M3 3v6h6" />
      <path d="M21 21v-6h-6" />
      <path d="M20 9a8 8 0 0 0-14-3L3 9" />
      <path d="M4 15a8 8 0 0 0 14 3l3-3" />
    </>
  ),
  check: (
    <>
      <path d="m20 6-11 11-5-5" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4.5h6v3H9z" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>
  ),
  bell: (
    <>
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  planning: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h8" />
      <circle cx="17" cy="12" r="3" />
      <path d="m18.5 14.5 2.5 2.5" />
    </>
  ),
  'route-plan': (
    <>
      <path d="M5 6h4" />
      <path d="M15 18h4" />
      <path d="M9 6c3 0 3 4 6 4s3 4 6 4" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="15" cy="18" r="2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  'dashboard-nav': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h4" />
      <path d="M13 8h4" />
      <path d="M7 12h4" />
      <path d="M13 12h4" />
      <path d="M13 16h4" />
    </>
  ),
  'projects-nav': (
    <>
      <path d="M3 10a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 11h18" />
    </>
  ),
  'licenses-nav': (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <circle cx="16.5" cy="13.5" r="1.5" />
    </>
  ),
  'inspections-nav': (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4.5h6v3H9z" />
      <path d="M9 12h6" />
      <path d="m9 16 1.8 1.8L15 13.6" />
    </>
  ),
  'erosions-nav': (
    <>
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>
  ),
  'visit-nav': (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h3l2 3h3l2 3" />
      <path d="M6 8v3l3 2v3" />
    </>
  ),
  'followups-nav': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 12h5" />
      <path d="m14 14 2 2 4-4" />
    </>
  ),
  'admin-nav': (
    <>
      <path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6z" />
      <path d="m9.5 12.5 2 2 3.5-3.5" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
      <path d="m7 12 3-3 2 2 3-3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  'chevron-left': (
    <>
      <path d="m15 18-6-6 6-6" />
    </>
  ),
  'chevron-right': (
    <>
      <path d="m9 18 6-6-6-6" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 7h2" />
      <path d="M14 7h2" />
      <path d="M8 11h2" />
      <path d="M14 11h2" />
      <path d="M8 15h2" />
      <path d="M14 15h2" />
      <path d="M11 21v-4h2v4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5" />
      <path d="m7 10 5-5 5 5" />
      <path d="M4 19h16" />
    </>
  ),
  login: (
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </>
  ),
  license: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h10" />
      <path d="M7 13h6" />
      <path d="M7 17h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <rect x="4" y="4" width="11" height="11" rx="2" />
    </>
  ),
  default: (
    <>
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
};

function AppIcon({
  name = 'default',
  size = 16,
  strokeWidth = 2,
  className = '',
  title = '',
}) {
  const path = ICON_PATHS[name] || ICON_PATHS.default;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`app-icon ${className}`.trim()}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : 'presentation'}
    >
      {title ? <title>{title}</title> : null}
      {path}
    </svg>
  );
}

export default AppIcon;
