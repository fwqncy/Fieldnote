import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { isoDate, mod, navigate, useApp, useSyncState, type Route } from '../hooks/app';
import { TEMPLATES } from '../store/templates';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Kbd, font, sx, v } from './kit';
import { fadeIn } from './motion';

type Item = { id: string; label: string; hint?: string; icon: IconName; group: string; keys?: string; run: () => void; keep?: boolean };

/** Subsequence match; consecutive & word-start hits score higher. */
function fuzzy(q: string, text: string): number {
  if (!q) return 1;
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q.toLowerCase()) {
    const at = t.indexOf(ch, ti);
    if (at < 0) return 0;
    streak = at === ti ? streak + 1 : 0;
    score += 1 + streak * 2 + (at === 0 || t[at - 1] === ' ' ? 3 : 0);
    ti = at + 1;
  }
  return score + (t.startsWith(q.toLowerCase()) ? 10 : 0);
}

export function CommandPalette({ mode: initialMode, onClose, route }: { mode: 'all' | 'notes' | 'templates'; onClose: () => void; route: Route }) {
  const { vault, sync, toast } = useApp();
  const { update, reduceMotion } = useTheme();
  const { expedition } = useSyncState();
  const [mode, setMode] = useState(initialMode);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<TextInput>(null);
  const box = useRef<View>(null);
  const returnTo = useRef<Element | null>(document.activeElement);

  useEffect(() => {
    input.current?.focus();
    const back = returnTo.current;
    return () => (back as HTMLElement | null)?.focus?.();
  }, []);
  useLayoutEffect(() => {
    if (!reduceMotion) fadeIn(box.current as unknown as HTMLElement);
  }, []);

  const noteId = route.name === 'note' ? route.id : undefined;
  const go = (r: Route) => () => navigate(r);

  const items = useMemo<Item[]>(() => {
    if (mode === 'templates') {
      return TEMPLATES.map((t) => ({
        id: `tpl:${t.id}`,
        label: t.name,
        hint: t.description,
        icon: 'template',
        group: noteId ? 'Insert into this note, or create new' : 'Create from template',
        run: () => {
          const date = isoDate();
          if (noteId) {
            const body = vault.notes.get(noteId)?.body ?? '';
            vault.editBody(noteId, (body.trim() ? body.replace(/\n*$/, '\n\n') : '') + t.body(date));
          } else navigate({ name: 'note', id: vault.create(t.title(date), t.body(date)), view: 'edit' });
        },
      }));
    }
    const notes: Item[] = vault
      .list()
      .filter((m) => !m.trashed)
      .map((m) => ({ id: `note:${m.id}`, label: m.title, hint: m.excerpt, icon: m.journal ? 'journal' : 'note', group: 'Notes', run: go({ name: 'note', id: m.id }) }));
    if (mode === 'notes') return notes;

    const cmds: Item[] = [
      { id: 'new', label: 'New Note', icon: 'plus', group: 'Commands', keys: '⌥N', run: () => navigate({ name: 'note', id: vault.create('Untitled', ''), view: 'edit' }) },
      { id: 'today', label: 'Open Today’s Journal Entry', icon: 'journal', group: 'Commands', run: () => navigate({ name: 'note', id: vault.journal(isoDate()) }) },
      { id: 'tpl', label: 'Use a Template…', icon: 'template', group: 'Commands', keep: true, run: () => (setMode('templates'), setQ(''), setActive(0)) },
      { id: 'switch', label: 'Quick Switcher…', icon: 'note', group: 'Commands', keys: `${mod}O`, keep: true, run: () => (setMode('notes'), setQ(''), setActive(0)) },
      { id: 'search', label: 'Search All Notes', icon: 'search', group: 'Go to', keys: `${mod}⇧F`, run: go({ name: 'search', q: '' }) },
      { id: 'graph', label: 'Open Constellation', icon: 'graph', group: 'Go to', run: go({ name: 'graph', focus: noteId }) },
      { id: 'tasks', label: 'Open Tasks', icon: 'tasks', group: 'Go to', run: go({ name: 'tasks' }) },
      { id: 'oracle', label: 'Consult the Oracle', icon: 'oracle', group: 'Go to', run: go({ name: 'oracle' }) },
      { id: 'home', label: 'Go Home', icon: 'home', group: 'Go to', run: go({ name: 'home' }) },
      { id: 'settings', label: 'Open Settings', icon: 'settings', group: 'Go to', run: go({ name: 'settings' }) },
      { id: 'trash', label: 'Open Trash', icon: 'trash', group: 'Go to', run: go({ name: 'trash' }) },
      {
        id: 'random',
        label: 'Open a Random Note',
        icon: 'dice',
        group: 'Go to',
        run: () => {
          const live = vault.list().filter((m) => !m.trashed);
          if (live.length) navigate({ name: 'note', id: live[Math.floor(Math.random() * live.length)].id });
        },
      },
      { id: 'exp', label: expedition ? 'Leave Expedition Mode & Sync' : 'Enter Expedition Mode (Go Offline)', icon: 'expedition', group: 'Sync', run: () => sync.setExpedition(!expedition) },
      { id: 'sync', label: 'Sync Now', icon: 'sync', group: 'Sync', run: () => sync.syncNow() },
      { id: 'apollo', label: 'Colour Scheme: Apollo', hint: 'Gold, black & lapis', icon: 'sun', group: 'Appearance', run: () => update({ scheme: 'apollo' }) },
      { id: 'tyrian', label: 'Colour Scheme: Tyrian', hint: 'Burgundy & navy', icon: 'palette', group: 'Appearance', run: () => update({ scheme: 'tyrian' }) },
      { id: 'custom', label: 'Colour Scheme: Your Colours…', icon: 'palette', group: 'Appearance', run: () => (update({ scheme: 'custom' }), navigate({ name: 'settings' })) },
      { id: 'dark', label: 'Dark Mode', icon: 'moon', group: 'Appearance', run: () => update({ mode: 'dark' }) },
      { id: 'light', label: 'Light Mode', icon: 'sun', group: 'Appearance', run: () => update({ mode: 'light' }) },
      { id: 'system', label: 'Match System Light or Dark', icon: 'monitor', group: 'Appearance', run: () => update({ mode: 'system' }) },
    ];
    if (noteId) {
      const meta = vault.meta(noteId);
      cmds.unshift(
        { id: 'edit', label: 'Toggle Edit & Read', icon: 'read', group: 'This note', keys: `${mod}E`, run: () => navigate({ name: 'note', id: noteId, view: route.name === 'note' && route.view === 'read' ? 'edit' : 'read' }, true) },
        { id: 'pal', label: 'Show as Palimpsest', hint: 'Every edit, by device', icon: 'layers', group: 'This note', run: () => navigate({ name: 'note', id: noteId, layer: 'palimpsest' }, true) },
        { id: 'stamp', label: 'Stamp Current Location', icon: 'location', group: 'This note', run: () => dispatchEvent(new CustomEvent('fieldnote:stamp')) },
        { id: 'pin', label: meta?.pinned ? 'Unpin Note' : 'Pin Note', icon: 'pin', group: 'This note', run: () => vault.setFlag(noteId, 'pinned', meta?.pinned ? '0' : '1') },
        {
          id: 'del',
          label: 'Move Note to Trash',
          icon: 'trash',
          group: 'This note',
          run: () => {
            vault.setFlag(noteId, 'trashed', '1');
            navigate({ name: 'home' });
            toast({ title: `Moved “${meta?.title}” to the trash`, tone: 'info', action: { label: 'Undo', run: () => (vault.setFlag(noteId, 'trashed', '0'), navigate({ name: 'note', id: noteId })) } });
          },
        },
      );
    }
    return q ? [...cmds, ...notes] : cmds;
  }, [mode, q !== '', noteId, expedition, vault.getVersion()]);

  const results = items
    .map((it) => ({ it, score: Math.max(fuzzy(q, it.label), fuzzy(q, it.hint ?? '') * 0.5) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => (q ? b.score - a.score : 0))
    .slice(0, 60)
    .map((r) => r.it);

  useEffect(() => setActive(0), [q, mode]);
  useEffect(() => {
    document.getElementById(`cmd-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (it: Item) => {
    it.run();
    if (!it.keep) onClose();
  };

  const onKey = (e: { nativeEvent: KeyboardEvent; preventDefault: () => void }) => {
    const k = e.nativeEvent.key;
    if (e.nativeEvent.isComposing) return;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (k === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length));
    } else if (k === 'Enter') {
      e.preventDefault();
      if (results[active]) run(results[active]);
      else if (q.trim() && mode !== 'templates') (navigate({ name: 'note', id: vault.create(q.trim(), '') }), onClose());
    } else if (k === 'Escape') {
      e.preventDefault();
      if (mode !== initialMode) setMode(initialMode);
      else onClose();
    } else if (k === 'Backspace' && !q && mode !== 'all') {
      setMode('all');
    } else if (k === 'Tab') e.preventDefault();
  };

  let lastGroup = '';
  return (
    <View style={s.wrap}>
      <Pressable style={s.scrim} onPress={onClose} aria-label="Close command palette" {...{ tabIndex: -1 }} />
      <View ref={box} role="dialog" aria-modal aria-label="Command palette" style={s.box}>
        <View style={s.inputRow}>
          <Icon name={mode === 'templates' ? 'template' : mode === 'notes' ? 'note' : 'command'} size={17} color={v('accent-ink')} />
          <TextInput
            ref={input}
            nativeID="cmd-input"
            value={q}
            onChangeText={setQ}
            onKeyPress={onKey as never}
            placeholder={mode === 'templates' ? 'Choose a template…' : mode === 'notes' ? 'Find a note by title…' : 'Type a command or note title…'}
            placeholderTextColor={v('text-faint') as string}
            aria-label="Command"
            role="combobox"
            aria-expanded
            aria-controls="cmd-list"
            aria-activedescendant={results[active] ? `cmd-${active}` : undefined}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            style={s.input}
          />
          <Kbd>esc</Kbd>
        </View>
        <ScrollView style={s.list} nativeID="cmd-list" {...({ role: 'listbox' } as object)} keyboardShouldPersistTaps="always">
          {results.length === 0 && (
            <Text style={s.empty}>{q.trim() && mode !== 'templates' ? `Press Enter to create “${q.trim()}”` : 'Nothing matches.'}</Text>
          )}
          {results.map((it, i) => {
            const header = it.group !== lastGroup && !q ? it.group : null;
            lastGroup = it.group;
            return (
              <View key={it.id}>
                {header && <Text style={s.group}>{header}</Text>}
                <Pressable
                  nativeID={`cmd-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPress={() => run(it)}
                  onHoverIn={() => setActive(i)}
                  {...{ tabIndex: -1 }}
                  style={[s.item, i === active && s.itemOn]}
                >
                  <Icon name={it.icon} size={15} color={i === active ? v('accent-ink') : v('text-muted')} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.label} numberOfLines={1}>
                      {it.label}
                    </Text>
                    {it.hint ? (
                      <Text style={s.hint} numberOfLines={1}>
                        {it.hint}
                      </Text>
                    ) : null}
                  </View>
                  {it.keys && <Kbd>{it.keys}</Kbd>}
                  {it.keep && <Icon name="chevronRight" size={14} color={v('text-faint')} />}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
        <View style={s.foot}>
          <Text style={s.footText}>↑↓ to move · ↵ to run · esc to {mode === initialMode ? 'close' : 'go back'}</Text>
        </View>
      </View>
    </View>
  );
}

const s = sx({
  wrap: { position: 'fixed', inset: 0, zIndex: 100, alignItems: 'center', paddingTop: '12vh', paddingHorizontal: 16 },
  scrim: { position: 'absolute', inset: 0, backgroundColor: 'rgba(3,5,10,.55)', backdropFilter: 'blur(3px)' },
  box: { width: '100%', maxWidth: 620, maxHeight: '70vh', borderRadius: 16, borderWidth: 1, borderColor: v('border-strong'), backgroundColor: v('surface'), overflow: 'hidden', boxShadow: `0 1px 0 rgba(255,255,255,.04) inset, 0 24px 64px -12px ${v('shadow')}, 0 4px 12px ${v('shadow')}` },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: v('border') },
  input: { flex: 1, minHeight: 54, fontFamily: font.ui, fontSize: 16, color: v('text'), outlineStyle: 'none' },
  list: { padding: 6 },
  group: { fontFamily: font.mono, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: v('text-faint'), paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, cursor: 'pointer' },
  itemOn: { backgroundColor: v('accent-soft') },
  label: { fontFamily: font.ui, fontSize: 14, color: v('text') },
  hint: { fontFamily: font.ui, fontSize: 12, color: v('text-muted') },
  empty: { padding: 20, textAlign: 'center', fontFamily: font.ui, fontSize: 14, color: v('text-muted') },
  foot: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: v('border'), backgroundColor: v('bg-elev') },
  footText: { fontFamily: font.mono, fontSize: 11, color: v('text-faint') },
});
