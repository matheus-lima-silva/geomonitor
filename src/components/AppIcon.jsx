import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Bell from 'lucide-react/dist/esm/icons/bell';
import Bold from 'lucide-react/dist/esm/icons/bold';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import ClipboardCheck from 'lucide-react/dist/esm/icons/clipboard-check';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Download from 'lucide-react/dist/esm/icons/download';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import FileCheck from 'lucide-react/dist/esm/icons/file-check';
import FileCheck2 from 'lucide-react/dist/esm/icons/file-check-2';
import FileDown from 'lucide-react/dist/esm/icons/file-down';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open';
import Info from 'lucide-react/dist/esm/icons/info';
import Italic from 'lucide-react/dist/esm/icons/italic';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard';
import List from 'lucide-react/dist/esm/icons/list';
import ListChecks from 'lucide-react/dist/esm/icons/list-checks';
import ListFilter from 'lucide-react/dist/esm/icons/list-filter';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Lock from 'lucide-react/dist/esm/icons/lock';
import LogIn from 'lucide-react/dist/esm/icons/log-in';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import Mail from 'lucide-react/dist/esm/icons/mail';
import MapIcon from 'lucide-react/dist/esm/icons/map';
import Menu from 'lucide-react/dist/esm/icons/menu';
import Monitor from 'lucide-react/dist/esm/icons/monitor';
import Pause from 'lucide-react/dist/esm/icons/pause';
import PenLine from 'lucide-react/dist/esm/icons/pen-line';
import Plus from 'lucide-react/dist/esm/icons/plus';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Route from 'lucide-react/dist/esm/icons/route';
import Save from 'lucide-react/dist/esm/icons/save';
import Search from 'lucide-react/dist/esm/icons/search';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Undo2 from 'lucide-react/dist/esm/icons/undo-2';
import Upload from 'lucide-react/dist/esm/icons/upload';
import User from 'lucide-react/dist/esm/icons/user';
import Users from 'lucide-react/dist/esm/icons/users';
import Waypoints from 'lucide-react/dist/esm/icons/waypoints';
import X from 'lucide-react/dist/esm/icons/x';

const ICON_MAP = {
  plus: Plus,
  save: Save,
  edit: PenLine,
  trash: Trash2,
  'trash-2': Trash2,
  details: FileText,
  close: X,
  x: X,
  csv: FileSpreadsheet,
  pdf: FileDown,
  'file-text': FileText,
  map: MapIcon,
  route: Route,
  reset: RefreshCw,
  check: Check,
  pause: Pause,
  user: User,
  users: Users,
  logout: LogOut,
  clipboard: ClipboardList,
  alert: AlertTriangle,
  bell: Bell,
  planning: ListFilter,
  'route-plan': Waypoints,
  shield: ShieldCheck,
  'dashboard-nav': LayoutDashboard,
  'projects-nav': FolderOpen,
  'licenses-nav': FileCheck,
  'inspections-nav': ClipboardCheck,
  'erosions-nav': AlertTriangle,
  'visit-nav': Route,
  'followups-nav': ListChecks,
  'admin-nav': ShieldCheck,
  monitor: Monitor,
  search: Search,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  menu: Menu,
  building: Building2,
  upload: Upload,
  download: Download,
  login: LogIn,
  lock: Lock,
  license: FileCheck2,
  info: Info,
  bold: Bold,
  italic: Italic,
  list: List,
  copy: Copy,
  eye: Eye,
  'eye-off': EyeOff,
  loader: Loader2,
  mail: Mail,
  undo: Undo2,
};

function AppIcon({
  name = 'default',
  size = 16,
  strokeWidth = 2,
  className = '',
  title = '',
}) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`inline-block shrink-0 ${className}`.trim()}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        role="presentation"
      >
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    );
  }

  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={`inline-block shrink-0 ${className}`.trim()}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
    />
  );
}

export default AppIcon;
