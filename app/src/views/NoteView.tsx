import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { href, longDate, navigate, num, relative, useApp, useMedia, useVault, type View as ViewMode } from '../hooks/app';
import { Icon } from '../ui/Icon';
import { Button, Kbd, Txt, font, sx, v } from '../ui/kit';
import { NotePanel } from '../panels/NotePanel';
import { Preview } from './Preview';
import { replicaColor } from './replicaColor';

const VIEW_KEY = 'fieldnote:view';

export function NoteView({ id, view: routeView, layer, showPanel, onTogglePanel }: { id: string; view?: ViewMode; layer?: 'palimpsest'; showPanel: boolean; onTogglePanel: () => void }) {
  const vault = useVault();
  const { toast } = useApp();
  const meta = vault.meta(id);
  const wide = useMedia('(min-width: 1100px)');
  const view: ViewMode = routeView ?? ((localStorage.getItem(VIEW_KEY) as ViewMode) || (meta?.body.trim() ? 'read' : 'edit'));
  const effectiveView = view === 'split' && !wide ? 'edit' : view;
  const [chronos, setChronos] = useState<number | null>(null);

  useEffect(() => setChronos(null), [id]);
  useEffect(() => {
    if (meta) document.title = `${meta.title} · Fieldnote`;
  }, [meta?.title]);

  if (!meta) {
    return (
      <View style={st.empty}>
        <Txt variant="title">This note isn’t here</Txt>
        <Txt variant="small">It may still be on another device. It will appear after the next sync.</Txt>
        <Button label="Go Home" icon="home" onPress={() => navigate({ name: 'home' })} />
      </View>
    );
  }

  const setView = (next: ViewMode) => {
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
    navigate({ name: 'note', id, view: next }, true);
  };

  const note = vault.notes.get(id)!;
  const history = chronos !== null ? note.history() : [];

  return (
    <View style={st.root}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Toolbar id={id} view={effectiveView} wide={wide} setView={setView} layer={layer} chronosOn={chronos !== null} toggleChronos={() => setChronos(chronos === null ? note.lamport : null)} showPanel={showPanel} onTogglePanel={onTogglePanel} />
        {chronos !== null && <Chronos id={id} at={chronos} setAt={setChronos} history={history} onClose={() => setChronos(null)} />}
        {meta.trashed && (
          <View style={st.banner} role="status">
            <Icon name="trash" size={15} color={v('danger')} />
            <Txt variant="small" style={{ flex: 1, color: v('text') }}>
              This note is in the trash.
            </Txt>
            <Button size="sm" label="Restore" icon="restore" onPress={() => vault.setFlag(id, 'trashed', '0')} />
          </View>
        )}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
          <View style={[st.page, effectiveView === 'split' && st.pageSplit]}>
            <TitleInput id={id} title={meta.title} journal={meta.journal} />
            <Txt variant="label" style={{ marginTop: 6, marginBottom: 18 }}>
              Edited {relative(meta.updated)} · {num(meta.words)} words · {num(meta.ops)} ops
              {meta.tags.length ? ' · ' : ''}
              {meta.tags.map((t, i) => (
                <Text key={t} role="link" {...{ href: href({ name: 'tag', tag: t }) }} style={{ color: v('ground-ink'), textDecorationLine: 'none' }}>
                  {i ? ' ' : ''}#{t}
                </Text>
              ))}
            </Txt>
            {chronos !== null ? (
              <View style={st.historic}>
                <Preview id={id} body={note.bodyAt(chronos)} depth={1} />
              </View>
            ) : layer === 'palimpsest' ? (
              <Palimpsest id={id} />
            ) : effectiveView === 'read' ? (
              <Preview id={id} body={meta.body} />
            ) : effectiveView === 'split' ? (
              <View style={st.split}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Editor id={id} body={meta.body} />
                </View>
                <View style={st.splitDivider} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Preview id={id} body={meta.body} />
                </View>
              </View>
            ) : (
              <Editor id={id} body={meta.body} />
            )}
          </View>
        </ScrollView>
      </View>
      {showPanel && <NotePanel id={id} onClose={onTogglePanel} />}
      <StampListener id={id} toast={toast} />
    </View>
  );
}

// ── toolbar ─────────────────────────────────────────────────────────────────
function Toolbar({ id, view, wide, setView, layer, chronosOn, toggleChronos, showPanel, onTogglePanel }: { id: string; view: ViewMode; wide: boolean; setView: (v: ViewMode) => void; layer?: 'palimpsest'; chronosOn: boolean; toggleChronos: () => void; showPanel: boolean; onTogglePanel: () => void }) {
  const vault = useVault();
  const { toast } = useApp();
  const meta = vault.meta(id)!;
  const views: { id: ViewMode; label: string; icon: 'edit' | 'read' | 'split' }[] = [
    { id: 'edit', label: 'Edit', icon: 'edit' },
    { id: 'read', label: 'Read', icon: 'read' },
    ...(wide ? [{ id: 'split' as const, label: 'Split', icon: 'split' as const }] : []),
  ];

  const trash = () => {
    vault.setFlag(id, 'trashed', '1');
    navigate({ name: 'home' });
    toast({ title: `Moved “${meta.title}” to the trash`, tone: 'info', action: { label: 'Undo', run: () => (vault.setFlag(id, 'trashed', '0'), navigate({ name: 'note', id })) } });
  };

  const exportMd = () => {
    const file = vault.exportMarkdown(id);
    if (!file) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([file.text], { type: 'text/markdown' }));
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <View style={st.toolbar}>
      <View style={st.crumbs}>
        <Text role="link" {...{ href: meta.journal ? '#/journal' : '#/' }} style={st.crumb}>
          {meta.journal ? 'Journal' : 'Notes'}
        </Text>
        <Icon name="chevronRight" size={13} color={v('text-faint')} />
        <Text style={[st.crumb, { color: v('text') }]} numberOfLines={1}>
          {meta.title}
        </Text>
      </View>
      <View role="radiogroup" aria-label="View mode" style={st.segment}>
        {views.map((m) => {
          const on = view === m.id && !layer;
          return (
            <Pressable key={m.id} role="radio" aria-checked={on} aria-label={`${m.label} mode`} onPress={() => setView(m.id)} style={(s) => [st.segBtn, on && st.segOn, (s as { hovered?: boolean }).hovered && !on && { backgroundColor: v('surface-3') }]}>
              <Icon name={m.icon} size={14} color={on ? v('text') : v('text-muted')} />
              <Text style={[st.segText, on && { color: v('text') }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={st.tools}>
        <Button size="sm" kind="ghost" hideLabel label={layer ? 'Leave palimpsest' : 'Palimpsest: show every edit'} icon="layers" onPress={() => navigate({ name: 'note', id, view, layer: layer ? undefined : 'palimpsest' }, true)} style={layer && { backgroundColor: v('accent-soft') }} />
        <Button size="sm" kind="ghost" hideLabel label={chronosOn ? 'Close Chronos' : 'Chronos: travel through versions'} icon="history" onPress={toggleChronos} style={chronosOn && { backgroundColor: v('accent-soft') }} />
        <Button size="sm" kind="ghost" hideLabel label="Stamp location" icon="location" onPress={() => dispatchEvent(new CustomEvent('fieldnote:stamp'))} />
        <Button size="sm" kind="ghost" hideLabel label={meta.pinned ? 'Unpin note' : 'Pin note'} icon={meta.pinned ? 'unpin' : 'pin'} onPress={() => vault.setFlag(id, 'pinned', meta.pinned ? '0' : '1')} />
        <Button size="sm" kind="ghost" hideLabel label="Export as Markdown" icon="download" onPress={exportMd} />
        {!meta.trashed && <Button size="sm" kind="ghost" hideLabel label="Move to trash" icon="trash" onPress={trash} />}
        <Button size="sm" kind="ghost" hideLabel label={showPanel ? 'Hide details panel' : 'Show details panel'} icon="panelRight" onPress={onTogglePanel} style={showPanel && { backgroundColor: v('surface-2') }} />
      </View>
    </View>
  );
}

// ── title ───────────────────────────────────────────────────────────────────
function TitleInput({ id, title, journal }: { id: string; title: string; journal?: string }) {
  const vault = useVault();
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string>();
  useEffect(() => setDraft(title), [title, id]);

  const commit = () => {
    const t = draft.trim();
    if (!t) return setDraft(title), setError(undefined);
    const clash = vault.resolve(t);
    if (clash && clash !== id) return setError(`Another note is already called “${t}”. Pick a different title.`);
    setError(undefined);
    vault.setTitle(id, t);
  };

  return (
    <View>
      {journal && <Txt variant="italic">{longDate(journal)}</Txt>}
      <TextInput
        value={draft}
        onChangeText={(t) => (setDraft(t), setError(undefined))}
        onBlur={commit}
        onSubmitEditing={commit}
        nativeID="note-title"
        aria-label="Note title"
        aria-invalid={!!error || undefined}
        placeholder="Untitled…"
        placeholderTextColor={v('text-faint') as string}
        spellCheck
        autoCorrect={false}
        style={st.title}
      />
      {error && (
        <Txt variant="small" tone="danger" role="alert">
          {error}
        </Txt>
      )}
    </View>
  );
}

// ── editor ──────────────────────────────────────────────────────────────────
const cpLen = (s: string) => Array.from(s).length;
const cuIndex = (s: string, cp: number) => Array.from(s).slice(0, cp).join('').length;

function Editor({ id, body }: { id: string; body: string }) {
  const vault = useVault();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const lastBody = useRef(body);
  const anchor = useRef<string | undefined>();
  const pendingCaret = useRef<number | null>(null);
  const [suggest, setSuggest] = useState<{ query: string; start: number; active: number } | null>(null);

  const note = vault.notes.get(id)!;

  // Anchor the caret to the op it sits after, so remote merges can't move it.
  const recordAnchor = () => {
    const el = ref.current;
    if (!el) return;
    const cp = cpLen(el.value.slice(0, el.selectionStart));
    anchor.current = cp > 0 ? note.visible[cp - 1] : '';
    const before = el.value.slice(0, el.selectionStart);
    const m = /\[\[([^\]\n|]*)$/.exec(before);
    setSuggest((s) => (m ? { query: m[1], start: el.selectionStart - m[1].length, active: s?.query === m[1] ? s.active : 0 } : null));
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(480, el.scrollHeight)}px`;
    if (pendingCaret.current !== null) {
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
      recordAnchor();
    } else if (body !== lastBody.current && document.activeElement === el && anchor.current !== undefined) {
      const at = anchor.current === '' ? 0 : note.visible.indexOf(anchor.current) + 1;
      if (at >= 0) {
        const cu = cuIndex(body, at);
        el.setSelectionRange(cu, cu);
      }
    }
    lastBody.current = body;
  });

  const write = (next: string, caret: number) => {
    pendingCaret.current = caret;
    lastBody.current = next;
    vault.editBody(id, next);
  };

  const options = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    const list = vault
      .list()
      .filter((m) => !m.trashed && m.id !== id && m.title.toLowerCase().includes(q))
      .sort((a, b) => Number(b.title.toLowerCase().startsWith(q)) - Number(a.title.toLowerCase().startsWith(q)))
      .slice(0, 6)
      .map((m) => ({ title: m.title, create: false }));
    if (q && !list.some((o) => o.title.toLowerCase() === q)) list.push({ title: suggest.query.trim(), create: true });
    return list;
  }, [suggest?.query, vault.getVersion()]);

  const accept = (title: string) => {
    const el = ref.current;
    if (!el || !suggest) return;
    const after = el.value.slice(el.selectionStart).replace(/^\]{0,2}/, '');
    const head = el.value.slice(0, suggest.start) + title + ']]';
    write(head + after, head.length);
    setSuggest(null);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (suggest && options.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const d = e.key === 'ArrowDown' ? 1 : -1;
          setSuggest({ ...suggest, active: (suggest.active + d + options.length) % options.length });
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          accept(options[suggest.active]?.title ?? suggest.query);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSuggest(null);
          return;
        }
      }
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === 'b' || e.key === 'i')) {
        e.preventDefault();
        const mark = e.key === 'b' ? '**' : '*';
        const { selectionStart: a, selectionEnd: b, value } = el;
        write(value.slice(0, a) + mark + value.slice(a, b) + mark + value.slice(b), b + mark.length * (a === b ? 1 : 2));
        return;
      }
      // Continue lists and tasks on Enter; an empty item ends the list.
      if (e.key === 'Enter' && !e.shiftKey && !meta && !e.altKey) {
        const { selectionStart: a, selectionEnd: b, value } = el;
        if (a !== b) return;
        const lineStart = value.lastIndexOf('\n', a - 1) + 1;
        const line = value.slice(lineStart, a);
        const m = /^(\s*)([-*+]|(\d+)[.)])\s+(\[[ xX]\]\s+)?/.exec(line);
        if (!m) return;
        e.preventDefault();
        if (line.trim() === m[0].trim()) {
          write(value.slice(0, lineStart) + value.slice(a), lineStart);
          return;
        }
        const bullet = m[3] ? `${Number(m[3]) + 1}${m[2].slice(-1)}` : m[2];
        const prefix = `\n${m[1]}${bullet} ${m[4] ? '[ ] ' : ''}`;
        write(value.slice(0, a) + prefix + value.slice(a), a + prefix.length);
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  });

  return (
    <View>
      <TextInput
        ref={(r) => {
          ref.current = r as unknown as HTMLTextAreaElement;
        }}
        nativeID="editor"
        multiline
        value={body}
        onChangeText={(t) => {
          lastBody.current = t;
          vault.editBody(id, t);
          requestAnimationFrame(recordAnchor);
        }}
        onSelectionChange={recordAnchor}
        onBlur={() => setTimeout(() => setSuggest(null), 150)}
        aria-label="Note body, Markdown"
        placeholder="Start writing… Type [[ to link a note, # to tag, - [ ] for a task."
        placeholderTextColor={v('text-faint') as string}
        spellCheck
        autoCapitalize="sentences"
        style={st.editor}
      />
      {suggest && options.length > 0 && (
        <View {...({ role: 'listbox' } as object)} aria-label="Link suggestions" style={st.suggest}>
          <Txt variant="label" style={{ paddingHorizontal: 10, paddingTop: 6 }}>
            Link to
          </Txt>
          {options.map((o, i) => (
            <Pressable key={o.title + o.create} role="option" aria-selected={i === suggest.active} onPress={() => accept(o.title)} style={(s) => [st.option, (i === suggest.active || (s as { hovered?: boolean }).hovered) && { backgroundColor: v('accent-soft') }]}>
              <Icon name={o.create ? 'plus' : 'note'} size={14} color={o.create ? v('accent-ink') : v('text-muted')} />
              <Text style={st.optionText} numberOfLines={1}>
                {o.create ? `Create “${o.title}”` : o.title}
              </Text>
              {i === suggest.active && <Kbd>↵</Kbd>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ── palimpsest: every character ever written, tinted by device ────────────
function Palimpsest({ id }: { id: string }) {
  const vault = useVault();
  const note = vault.notes.get(id)!;
  const segments = note.palimpsest();
  const names = vault.deviceNames();
  const authors = [...new Set(segments.map((s) => s.replica))];
  const deleted = segments.filter((s) => s.deleted).reduce((n, s) => n + cpLen(s.text), 0);
  return (
    <View style={{ gap: 16 }}>
      <View style={st.legend}>
        <Txt variant="small" style={{ color: v('text') }}>
          Every character this note has ever held. Struck-through text was deleted ({num(deleted)} characters), but a CRDT never forgets.
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {authors.map((r) => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: replicaColor(r, vault.replica) }} />
              <Txt variant="small">{names.get(r) ?? `Device ${r.slice(0, 4)}`}{r === vault.replica ? ' (this device)' : ''}</Txt>
            </View>
          ))}
        </View>
      </View>
      <Text style={st.palimpsest} selectable>
        {segments.map((s, i) => (
          <Text key={i} style={[{ color: replicaColor(s.replica, vault.replica) }, s.deleted && st.deleted]}>
            {s.text}
          </Text>
        ))}
      </Text>
    </View>
  );
}

// ── chronos: scrub through history ─────────────────────────────────────────
function Chronos({ id, at, setAt, history, onClose }: { id: string; at: number; setAt: (n: number) => void; history: { lamport: number; ts: number; replica: string }[]; onClose: () => void }) {
  const vault = useVault();
  const { toast } = useApp();
  const idx = Math.max(0, history.findIndex((h) => h.lamport >= at));
  const point = history[idx];
  const names = vault.deviceNames();
  const latest = idx === history.length - 1;
  const restore = () => {
    const note = vault.notes.get(id)!;
    const old = note.bodyAt(at);
    const current = note.body;
    vault.editBody(id, old);
    onClose();
    toast({ title: 'Restored an earlier version', detail: 'The restore is a new edit, so you can travel back past it.', tone: 'success', action: { label: 'Undo', run: () => vault.editBody(id, current) } });
  };
  return (
    <View style={st.chronos} role="region" aria-label="Chronos, version history">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="history" size={16} color={v('accent-ink')} />
        <Txt variant="heading">Chronos</Txt>
        <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>
          Version {num(idx + 1)} of {num(history.length)} · {point && new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(point.ts)} · {point && (names.get(point.replica) ?? 'Unknown device')}
        </Txt>
        <Button size="sm" kind="primary" label="Restore This Version" icon="restore" disabled={latest} onPress={restore} />
        <Button size="sm" kind="ghost" label="Close" hideLabel icon="close" onPress={onClose} />
      </View>
      <input
        type="range"
        min={0}
        max={Math.max(0, history.length - 1)}
        value={idx}
        aria-label="Version"
        aria-valuetext={point ? new Date(point.ts).toLocaleString() : undefined}
        onChange={(e) => setAt(history[Number(e.target.value)].lamport)}
      />
    </View>
  );
}

// ── location stamp ─────────────────────────────────────────────────────────
function StampListener({ id, toast }: { id: string; toast: ReturnType<typeof useApp>['toast'] }) {
  const vault = useVault();
  useEffect(() => {
    const on = () => {
      if (!('geolocation' in navigator)) return toast({ title: 'Location isn’t available on this device', tone: 'danger' });
      toast({ title: 'Finding your position…', detail: 'GPS works without signal; it can take a minute outdoors.', tone: 'info' });
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const { latitude: la, longitude: lo, accuracy, altitude } = p.coords;
          const f = (n: number) => Math.abs(n).toFixed(4);
          const stamp = `📍 ${f(la)}° ${la >= 0 ? 'N' : 'S'}, ${f(lo)}° ${lo >= 0 ? 'E' : 'W'} · ±${Math.round(accuracy)} m${altitude != null ? ` · ${num(Math.round(altitude))} m` : ''} · ${new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(p.timestamp)}`;
          const body = vault.notes.get(id)?.body ?? '';
          vault.editBody(id, body + (body.endsWith('\n') || !body ? '' : '\n') + stamp + '\n');
          toast({ title: 'Location stamped', detail: stamp, tone: 'success' });
        },
        (err) =>
          toast({
            title: err.code === err.PERMISSION_DENIED ? 'Location permission was denied' : 'Couldn’t get a position',
            detail: err.code === err.PERMISSION_DENIED ? 'Allow location for this site in your browser settings, then try again.' : 'Move into open sky and try again.',
            tone: 'danger',
          }),
        { enableHighAccuracy: true, timeout: 60_000, maximumAge: 30_000 },
      );
    };
    addEventListener('fieldnote:stamp', on);
    return () => removeEventListener('fieldnote:stamp', on);
  }, [id]);
  return null;
}

const st = sx({
  root: { flex: 1, flexDirection: 'row', minWidth: 0, minHeight: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: v('border'), flexWrap: 'wrap', paddingVertical: 8 },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 120 },
  crumb: { fontFamily: font.ui, fontSize: 13, color: v('text-muted'), textDecorationLine: 'none' },
  segment: { flexDirection: 'row', padding: 2, gap: 2, borderRadius: 8, backgroundColor: v('surface-2'), borderWidth: 1, borderColor: v('border') },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 26, borderRadius: 6, cursor: 'pointer' },
  segOn: { backgroundColor: v('surface'), boxShadow: `0 1px 2px ${v('shadow')}` },
  segText: { fontFamily: font.ui, fontSize: 12.5, fontWeight: '500', color: v('text-muted') },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: v('danger-soft'), borderBottomWidth: 1, borderBottomColor: v('border') },
  scroll: { flexGrow: 1, paddingBottom: 120 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 36 },
  pageSplit: { maxWidth: 1400 },
  title: { fontFamily: font.serif, fontWeight: '600', fontSize: 44, lineHeight: 50, color: v('text'), outlineStyle: 'none', paddingVertical: 0, letterSpacing: -0.4 },
  editor: { minHeight: 480, fontFamily: font.ui, fontSize: 15.5, lineHeight: 26, caretColor: v('accent'), resize: 'none', color: v('text'), backgroundColor: 'transparent', paddingVertical: 0, outlineStyle: 'none', overflow: 'hidden' },
  split: { flexDirection: 'row', gap: 28 },
  splitDivider: { width: 1, backgroundColor: v('border') },
  suggest: { position: 'sticky', bottom: 16, marginTop: 8, maxWidth: 420, backgroundColor: v('surface'), borderWidth: 1, borderColor: v('border-strong'), borderRadius: 12, padding: 4, boxShadow: `0 12px 32px -8px ${v('shadow')}` },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34, paddingHorizontal: 10, borderRadius: 8, cursor: 'pointer' },
  optionText: { flex: 1, fontFamily: font.ui, fontSize: 14, color: v('text') },
  legend: { gap: 10, padding: 14, borderRadius: 12, backgroundColor: v('surface'), borderWidth: 1, borderColor: v('border') },
  palimpsest: { fontFamily: font.mono, fontSize: 14.5, lineHeight: 26, whiteSpace: 'pre-wrap' },
  chronos: { gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: v('border'), backgroundColor: v('accent-soft') },
  deleted: { textDecorationLine: 'line-through', opacity: 0.5 },
  historic: { padding: 20, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: v('accent-line'), backgroundColor: v('surface') },
});
