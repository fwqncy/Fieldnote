import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppContext, useApp, duration, href, isoDate, mod, navigate, num, relative, roman, useMedia, useRoute, useSyncState, useVault, type AppCtx, type Route, type Toast } from './hooks/app';
import type { SyncClient } from './sync/client';
import type { Vault } from './store/vault';
import { CommandPalette } from './ui/CommandPalette';
import { Icon, type IconName } from './ui/Icon';
import { Button, Field, Label, Row, Txt, font, sx, v } from './ui/kit';
import { Meander, SunMark } from './ui/Ornaments';
import { Toasts } from './ui/Toasts';
import { GraphView } from './views/GraphView';
import { Home } from './views/Home';
import { Journal, Oracle, Search, TagView, Tasks, Trash } from './views/Lists';
import { NoteView } from './views/NoteView';
import { Settings } from './views/Settings';

export function App({ vault, sync }: { vault: Vault; sync: SyncClient }) {
  const route = useRoute();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [palette, setPalette] = useState<null | 'all' | 'notes' | 'templates'>(null);
  const [drawer, setDrawer] = useState(false);
  const [panel, setPanel] = useState(() => matchMedia('(min-width: 1180px)').matches);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wide = useMedia('(min-width: 860px)');

  const ctx = useMemo<AppCtx>(
    () => ({
      vault,
      sync,
      toast: (t) => setToasts((all) => [...all.slice(-3), { ...t, id: Date.now() + Math.random() }]),
      openPalette: (mode = 'all') => setPalette(mode),
    }),
    [vault, sync],
  );

  // "Back online after 3 days · 41 edits merged, 0 conflicts"
  useEffect(() => {
    sync.onReconnect = ({ away, edits, conflicts }) => {
      if (away < 20_000 && edits === 0) return;
      ctx.toast({ title: `Back online after ${duration(away)}`, detail: `${num(edits)} ${edits === 1 ? 'edit' : 'edits'} merged, ${conflicts} conflicts`, tone: 'success' });
    };
  }, [sync, ctx]);

  useEffect(() => setDrawer(false), [location.hash]);
  useEffect(() => {
    if (route.name !== 'note') document.title = 'Fieldnote';
  }, [route.name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = e.metaKey || e.ctrlKey;
      if (m && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => (p ? null : 'all'));
      } else if (m && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setPalette('notes');
      } else if (m && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        navigate({ name: 'search', q: '' });
      } else if (m && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen((o) => !o);
      } else if (m && e.key.toLowerCase() === 'e' && route.name === 'note') {
        e.preventDefault();
        navigate({ name: 'note', id: route.id, view: route.view === 'read' ? 'edit' : 'read' }, true);
      } else if (e.altKey && e.code === 'KeyN') {
        e.preventDefault();
        navigate({ name: 'note', id: vault.create('Untitled', '') });
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [route]);

  return (
    <AppContext.Provider value={ctx}>
      <View style={s.shell}>
        <View style={s.body}>
          {wide && <Ribbon route={route} />}
          {wide && sidebarOpen && <Sidebar route={route} />}
          {!wide && drawer && (
            <View style={s.drawerWrap}>
              <Pressable style={s.scrim} onPress={() => setDrawer(false)} aria-label="Close menu" />
              <View style={s.drawer} role="dialog" aria-modal aria-label="Navigation">
                <Sidebar route={route} />
              </View>
            </View>
          )}
          <View style={s.main} nativeID="main" role="main" {...{ tabIndex: -1 }}>
            {!wide && <MobileBar onMenu={() => setDrawer(true)} />}
            <View style={{ flex: 1, minHeight: 0 }}>
              <Screen route={route} panel={panel} togglePanel={() => setPanel((p) => !p)} />
            </View>
          </View>
        </View>
        {wide ? <StatusBar route={route} /> : <TabBar route={route} />}
        {palette && <CommandPalette mode={palette} onClose={() => setPalette(null)} route={route} />}
        <Toasts toasts={toasts} dismiss={(id) => setToasts((all) => all.filter((t) => t.id !== id))} />
      </View>
    </AppContext.Provider>
  );
}

function Screen({ route, panel, togglePanel }: { route: Route; panel: boolean; togglePanel: () => void }) {
  switch (route.name) {
    case 'note':
      return <NoteView key={route.id} id={route.id} view={route.view} layer={route.layer} showPanel={panel} onTogglePanel={togglePanel} />;
    case 'graph':
      return <GraphView focus={route.focus} />;
    case 'journal':
      return <Journal />;
    case 'tasks':
      return <Tasks filter={route.filter} />;
    case 'search':
      return <Search q={route.q} />;
    case 'tag':
      return <TagView tag={route.tag} />;
    case 'oracle':
      return <Oracle />;
    case 'trash':
      return <Trash />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}

const NAV: { name: Route['name']; label: string; icon: IconName; to: string }[] = [
  { name: 'home', label: 'Home', icon: 'home', to: '#/' },
  { name: 'search', label: 'Search', icon: 'search', to: '#/search' },
  { name: 'graph', label: 'Constellation', icon: 'graph', to: '#/graph' },
  { name: 'journal', label: 'Journal', icon: 'journal', to: '#/journal' },
  { name: 'tasks', label: 'Tasks', icon: 'tasks', to: '#/tasks' },
  { name: 'oracle', label: 'Oracle', icon: 'oracle', to: '#/oracle' },
];

function Ribbon({ route }: { route: Route }) {
  const { expedition } = useSyncState();
  return (
    <View style={s.ribbon} role="navigation" aria-label="Primary">
      <Pressable role="link" {...{ href: '#/' }} aria-label="Fieldnote home" style={s.brandBtn}>
        <SunMark size={28} />
      </Pressable>
      {NAV.map((n) => (
        <RibbonButton key={n.name} icon={n.icon} label={n.label} to={n.to} active={route.name === n.name} />
      ))}
      <View style={{ flex: 1 }} />
      <ExpeditionButton on={expedition} />
      <RibbonButton icon="trash" label="Trash" to="#/trash" active={route.name === 'trash'} />
      <RibbonButton icon="settings" label="Settings" to="#/settings" active={route.name === 'settings'} />
    </View>
  );
}

function RibbonButton({ icon, label, to, active }: { icon: IconName; label: string; to: string; active: boolean }) {
  return (
    <Pressable role="link" aria-label={label} aria-current={active ? 'page' : undefined} {...{ href: to, title: label }} style={(st) => [s.ribbonBtn, (st as { hovered?: boolean }).hovered && { backgroundColor: v('surface-2') }, active && s.ribbonOn]}>
      <Icon name={icon} size={19} color={active ? v('accent-ink') : v('text-muted')} />
    </Pressable>
  );
}

function ExpeditionButton({ on }: { on: boolean }) {
  const { sync } = useApp();
  return (
    <Pressable
      role="switch"
      aria-checked={on}
      aria-label="Expedition mode"
      {...{ title: on ? 'Expedition mode is on: no network' : 'Expedition mode: go offline on purpose' }}
      onPress={() => sync.setExpedition(!on)}
      style={(st) => [s.ribbonBtn, (st as { hovered?: boolean }).hovered && { backgroundColor: v('surface-2') }, on && { backgroundColor: v('accent'), }]}
    >
      <Icon name="expedition" size={19} color={on ? v('on-accent') : v('text-muted')} />
    </Pressable>
  );
}


function Sidebar({ route }: { route: Route }) {
  const vault = useVault();
  const [filter, setFilter] = useState('');
  const [tagsOpen, setTagsOpen] = useState(true);
  const all = vault.list().filter((m) => !m.trashed);
  const q = filter.trim().toLowerCase();
  const match = (t: string) => !q || t.toLowerCase().includes(q);
  const pinned = all.filter((m) => m.pinned && match(m.title));
  const notes = all.filter((m) => !m.pinned && !m.journal && match(m.title));
  const journals = all.filter((m) => m.journal && match(m.title)).sort((a, b) => b.journal!.localeCompare(a.journal!)).slice(0, 5);
  const tags = [...vault.index().tags.entries()].sort((a, b) => b[1].length - a[1].length);
  const now = new Date();
  const current = route.name === 'note' ? route.id : undefined;

  return (
    <View style={s.sidebar} role="navigation" aria-label="Notes">
      <View style={s.sideHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.brand} {...({ translate: 'no' } as object)}>
            Fieldnote
          </Text>
          <Txt variant="label" style={{ fontSize: 10 }}>
            {roman(now.getMonth() + 1)} · {roman(now.getFullYear())} · Vault
          </Txt>
        </View>
        <Button size="sm" kind="primary" hideLabel icon="plus" label="New note" onPress={() => navigate({ name: 'note', id: vault.create('Untitled', '') })} />
      </View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
        <Field icon="search" placeholder="Filter notes…" value={filter} onChangeText={setFilter} aria-label="Filter notes" autoCorrect={false} autoCapitalize="none" />
      </View>
      <Meander height={10} style={{ opacity: 0.5 }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8, paddingBottom: 24, gap: 14 }}>
        {pinned.length > 0 && (
          <Group roman="I" title="Pinned">
            {pinned.map((m) => (
              <NoteRow key={m.id} id={m.id} title={m.title} active={current === m.id} icon="pin" />
            ))}
          </Group>
        )}
        <Group roman={pinned.length ? 'II' : 'I'} title={`Notes · ${notes.length}`}>
          {notes.map((m) => (
            <NoteRow key={m.id} id={m.id} title={m.title} active={current === m.id} sub={relative(m.updated)} />
          ))}
          {notes.length === 0 && (
            <Txt variant="small" style={{ paddingHorizontal: 10 }}>
              {q ? 'No titles match.' : 'No notes yet.'}
            </Txt>
          )}
        </Group>
        <Group roman={pinned.length ? 'III' : 'II'} title="Journal" action={<Button size="sm" kind="ghost" hideLabel icon="plus" label="Today’s entry" onPress={() => navigate({ name: 'note', id: vault.journal(isoDate()) })} />}>
          {journals.map((m) => (
            <NoteRow key={m.id} id={m.id} title={m.title} active={current === m.id} icon="journal" />
          ))}
        </Group>
        <Group
          roman={pinned.length ? 'IV' : 'III'}
          title="Tags"
          action={<Button size="sm" kind="ghost" hideLabel icon={tagsOpen ? 'chevronDown' : 'chevronRight'} label={tagsOpen ? 'Collapse tags' : 'Expand tags'} onPress={() => setTagsOpen(!tagsOpen)} aria-expanded={tagsOpen} />}
        >
          {tagsOpen && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8 }}>
              {tags.map(([t, ids]) => (
                <Pressable key={t} role="link" {...{ href: href({ name: 'tag', tag: t }) }} style={(st) => [s.tag, ((st as { hovered?: boolean }).hovered || (route.name === 'tag' && route.tag === t)) && s.tagOn]}>
                  <Text style={s.tagText}>
                    #{t} <Text style={{ color: v('text-faint') }}>{ids.length}</Text>
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Group>
      </ScrollView>
      <SyncCard />
    </View>
  );
}

function Group({ roman: r, title, children, action }: { roman: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, minHeight: 28 }}>
        <Label roman={r} style={{ flex: 1 }}>
          {title}
        </Label>
        {action}
      </View>
      {children}
    </View>
  );
}

function NoteRow({ id, title, active, sub, icon = 'note' }: { id: string; title: string; active: boolean; sub?: string; icon?: IconName }) {
  return (
    <Row href={href({ name: 'note', id })} selected={active} style={{ minHeight: 32 }}>
      <Icon name={icon} size={14} color={active ? v('accent-ink') : v('text-faint')} />
      <Text style={[s.rowTitle, active && { color: v('text'), fontWeight: '500' }]} numberOfLines={1}>
        {title}
      </Text>
      {sub && (
        <Text style={s.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </Row>
  );
}

function SyncCard() {
  const st = useSyncState();
  const { sync } = useApp();
  const off = st.status === 'offline' || st.status === 'expedition';
  return (
    <View style={[s.syncCard, off ? s.syncOff : s.syncOn]} role="status" aria-live="polite">
      <Icon name={st.status === 'syncing' ? 'loader' : off ? (st.expedition ? 'expedition' : 'offline') : 'online'} spin={st.status === 'syncing'} size={16} color={off ? v('accent-ink') : v('success')} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.syncTitle} numberOfLines={1}>
          {st.status === 'expedition' ? 'Expedition mode' : st.status === 'offline' ? 'Working offline' : st.status === 'syncing' ? 'Syncing…' : 'In sync'}
        </Text>
        <Text style={s.syncSub} numberOfLines={1}>
          {off ? `${num(st.queued)} ops waiting${st.offlineSince ? ` · ${duration(Date.now() - st.offlineSince)}` : ''}` : st.lastSync ? `Last sync ${relative(st.lastSync)}` : 'Saved on this device'}
        </Text>
      </View>
      {!st.expedition && <Button size="sm" kind="ghost" hideLabel icon="sync" label="Sync now" onPress={() => sync.syncNow()} />}
    </View>
  );
}

function StatusBar({ route }: { route: Route }) {
  const vault = useVault();
  const { openPalette } = useApp();
  const st = useSyncState();
  const meta = route.name === 'note' ? vault.meta(route.id) : undefined;
  return (
    <View style={s.status} role="contentinfo">
      <Text style={s.statusText}>
        {st.status === 'expedition' ? '⛰ Expedition' : st.status === 'offline' ? '○ Offline' : st.status === 'syncing' ? '◐ Syncing' : '● Online'} · {num(st.queued)} queued · 0 conflicts
      </Text>
      <View style={{ flex: 1 }} />
      {meta && (
        <Text style={s.statusText}>
          {num(meta.words)} words · {num(Array.from(meta.body).length)} characters · λ {num(vault.notes.get(meta.id)!.lamport)}
        </Text>
      )}
      <Pressable role="button" onPress={() => openPalette()} style={s.statusBtn} aria-label="Open command palette">
        <Text style={s.statusText}>{mod}K Commands</Text>
      </Pressable>
    </View>
  );
}

function MobileBar({ onMenu }: { onMenu: () => void }) {
  const { openPalette } = useApp();
  return (
    <View style={s.mobileBar}>
      <Button kind="ghost" hideLabel icon="menu" label="Open menu" onPress={onMenu} />
      <Pressable role="link" {...{ href: '#/' }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }} aria-label="Fieldnote home">
        <SunMark size={22} />
        <Text style={[s.brand, { fontSize: 20 }]}>Fieldnote</Text>
      </Pressable>
      <Button kind="ghost" hideLabel icon="command" label="Commands" onPress={() => openPalette()} />
    </View>
  );
}

function TabBar({ route }: { route: Route }) {
  const tabs = NAV.filter((n) => n.name !== 'oracle').concat({ name: 'settings', label: 'Settings', icon: 'settings', to: '#/settings' });
  return (
    <View style={s.tabbar} role="navigation" aria-label="Primary">
      {tabs.map((t) => {
        const on = route.name === t.name;
        return (
          <Pressable key={t.name} role="link" aria-current={on ? 'page' : undefined} aria-label={t.label} {...{ href: t.to }} style={s.tab}>
            <Icon name={t.icon} size={20} color={on ? v('accent-ink') : v('text-muted')} />
            <Text style={[s.tabText, on && { color: v('accent-ink') }]} numberOfLines={1}>
              {t.label === 'Constellation' ? 'Graph' : t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = sx({
  shell: { flex: 1, height: '100dvh', backgroundColor: v('bg'), overflow: 'hidden' },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  ribbon: { width: 56, alignItems: 'center', paddingVertical: 12, gap: 4, borderRightWidth: 1, borderRightColor: v('border'), backgroundColor: v('bg') },
  brandBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 10, borderRadius: 10 },
  ribbonBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '120ms' },
  ribbonOn: { backgroundColor: v('accent-soft') },
  sidebar: { width: 272, flex: 1, maxWidth: 272, borderRightWidth: 1, borderRightColor: v('border'), backgroundColor: v('bg-elev') },
  sideHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  brand: { fontFamily: font.display, fontWeight: '800', fontSize: 26, letterSpacing: 1.5, textTransform: 'uppercase', color: v('focus'), lineHeight: 26 },
  rowTitle: { flex: 1, fontFamily: font.ui, fontSize: 13.5, color: v('text-muted') },
  rowSub: { fontFamily: font.ui, fontSize: 11.5, color: v('text-faint'), fontVariantNumeric: 'tabular-nums' },
  tag: { paddingHorizontal: 8, minHeight: 24, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: v('border'), textDecorationLine: 'none' },
  tagOn: { borderColor: v('accent-line'), backgroundColor: v('accent-soft') },
  tagText: { fontFamily: font.mono, fontSize: 11.5, color: v('ground-ink') },
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 10, paddingLeft: 12, paddingRight: 4, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  syncOn: { borderColor: v('border'), backgroundColor: v('surface') },
  syncOff: { borderColor: v('accent-line'), backgroundColor: v('accent-soft') },
  syncTitle: { fontFamily: font.ui, fontSize: 13, fontWeight: '600', color: v('text') },
  syncSub: { fontFamily: font.ui, fontSize: 11.5, color: v('text-muted'), fontVariantNumeric: 'tabular-nums' },
  main: { flex: 1, minWidth: 0, backgroundColor: v('bg'), outlineStyle: 'none' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 16, height: 26, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: v('border'), backgroundColor: v('bg') },
  statusText: { fontFamily: font.mono, fontSize: 11, color: v('text-faint'), fontVariantNumeric: 'tabular-nums' },
  statusBtn: { paddingHorizontal: 6, borderRadius: 4, cursor: 'pointer' },
  mobileBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 'max(6px, env(safe-area-inset-top))', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: v('border') },
  tabbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: v('border'), backgroundColor: v('bg-elev'), paddingBottom: 'env(safe-area-inset-bottom)' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 56, textDecorationLine: 'none' },
  tabText: { fontFamily: font.ui, fontSize: 10.5, color: v('text-muted') },
  drawerWrap: { position: 'absolute', inset: 0, zIndex: 50, flexDirection: 'row' },
  scrim: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,.5)' },
  drawer: { width: 'min(300px, 86vw)', height: '100%', backgroundColor: v('bg-elev'), boxShadow: `24px 0 48px -16px ${v('shadow')}` },
});
