import * as L from 'lucide-react';

const icons = {
  home: L.House,
  search: L.Search,
  graph: L.Waypoints,
  journal: L.BookOpen,
  calendar: L.CalendarDays,
  tasks: L.ListChecks,
  oracle: L.Sparkles,
  settings: L.Settings,
  plus: L.Plus,
  pin: L.Pin,
  unpin: L.PinOff,
  trash: L.Trash2,
  restore: L.RotateCcw,
  loader: L.LoaderCircle,
  offline: L.CloudOff,
  online: L.Cloud,
  expedition: L.MountainSnow,
  history: L.History,
  layers: L.Layers,
  location: L.MapPin,
  note: L.FileText,
  hash: L.Hash,
  link: L.Link,
  external: L.ArrowUpRight,
  close: L.X,
  command: L.Command,
  menu: L.Menu,
  panelLeft: L.PanelLeft,
  panelRight: L.PanelRight,
  check: L.Check,
  chevronRight: L.ChevronRight,
  chevronDown: L.ChevronDown,
  chevronUp: L.ChevronUp,
  download: L.Download,
  upload: L.Upload,
  palette: L.Palette,
  sun: L.Sun,
  moon: L.Moon,
  monitor: L.Monitor,
  edit: L.Pencil,
  read: L.Eye,
  split: L.Columns2,
  leaf: L.Leaf,
  copy: L.Copy,
  template: L.LayoutTemplate,
  sync: L.RefreshCw,
  orbit: L.Orbit,
  info: L.Info,
  feather: L.Feather,
  scroll: L.Scroll,
  pipette: L.Pipette,
  undo: L.Undo2,
  dice: L.Dices,
} as const;

export type IconName = keyof typeof icons;

/** Decorative by default; pass `label` when the icon is the only content. */
export function Icon({ name, size = 16, color = 'currentColor', spin, label, strokeWidth = 1.75 }: { name: IconName; size?: number; color?: string; spin?: boolean; label?: string; strokeWidth?: number }) {
  const C = icons[name];
  return (
    <C
      width={size}
      height={size}
      color={color}
      strokeWidth={strokeWidth}
      className={spin ? 'fn-spin' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      style={{ flexShrink: 0 }}
    />
  );
}
