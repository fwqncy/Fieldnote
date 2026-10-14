// Journal, Tasks, Search/Tag, Oracle and Trash: the views built from the index.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { href, isoDate, longDate, navigate, num, relative, useApp, useVault } from '../hooks/app';
import { useTheme } from '../theme/ThemeProvider';
import type { NoteMeta } from '../store/vault';
import { Icon } from '../ui/Icon';
import { Button, Card, Field, Label, Row, Txt, font, sx, v } from '../ui/kit';
import { Checker, Laurel, Meander, SunMark } from '../ui/Ornaments';
import { Preview } from './Preview';

function Page({ kicker, title, children, actions }: { kicker: string; title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Fieldnote`;
  }, [title]);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.page}>
      <View style={s.header}>
        <View style={{ flex: 1, gap: 4, minWidth: 220 }}>
          <Txt variant="label" tone="accent">
            {kicker}
          </Txt>
          <Txt variant="display" role="heading" aria-level={1}>
            {title}
          </Txt>
        </View>
        {actions}
      </View>
      <Meander height={12} style={{ marginBottom: 24, opacity: 0.7 }} />
      {children}
    </ScrollView>
  );
}

// ── journal ────────────────────────────────────────────────────────────────
export function Journal() {
  const vault = useVault();
  const today = isoDate();
  const entries = vault
    .list()
    .filter((m) => m.journal && !m.trashed)
    .sort((a, b) => b.journal!.localeCompare(a.journal!));
  const hasToday = entries.some((e) => e.journal === today);
  return (
    <Page kicker="Daily notes" title="Journal" actions={<Button kind="primary" icon="journal" label={hasToday ? 'Open Today' : 'Start Today’s Entry'} onPress={() => navigate({ name: 'note', id: vault.journal(today) })} />}>
      <View style={{ gap: 20 }}>
        {entries.length === 0 && <Empty icon="journal" title="No journal entries yet" body="One page per day, titled by date. Start today’s and it will be waiting here tomorrow." />}
        {entries.map((e) => (
          <Card key={e.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <Text role="link" {...{ href: href({ name: 'note', id: e.id }) }} style={s.entryTitle}>
                {longDate(e.journal!)}
              </Text>
              <Txt variant="label">{e.journal === today ? 'Today' : relative(new Date(e.journal + 'T12:00').getTime())}</Txt>
            </View>
            {e.body.trim() ? <Preview id={e.id} body={e.body} depth={1} /> : <Txt variant="small">Nothing written yet.</Txt>}
          </Card>
        ))}
      </View>
    </Page>
  );
}

// ── tasks ──────────────────────────────────────────────────────────────────
export function Tasks({ filter = 'open' }: { filter?: 'open' | 'done' | 'all' }) {
  const vault = useVault();
  const all = vault.index().tasks;
  const shown = all.filter(({ task }) => (filter === 'all' ? true : filter === 'done' ? task.done : !task.done));
  const groups = new Map<string, typeof shown>();
  for (const t of shown) groups.set(t.note, [...(groups.get(t.note) ?? []), t]);
  const open = all.filter((t) => !t.task.done).length;
  return (
    <Page kicker={`${num(open)} open · ${num(all.length - open)} done`} title="Tasks">
      <View role="tablist" aria-label="Filter tasks" style={s.tabs}>
        {(['open', 'done', 'all'] as const).map((f) => (
          <Pressable key={f} role="tab" aria-selected={filter === f} onPress={() => navigate({ name: 'tasks', filter: f }, true)} style={(st) => [s.tab, filter === f && s.tabOn, (st as { hovered?: boolean }).hovered && filter !== f && { backgroundColor: v('surface-2') }]}>
            <Text style={[s.tabText, filter === f && { color: v('text') }]}>{f === 'open' ? 'Open' : f === 'done' ? 'Done' : 'All'}</Text>
          </Pressable>
        ))}
      </View>
      {shown.length === 0 && <Empty icon="tasks" title={filter === 'done' ? 'Nothing finished yet' : 'Nothing left to do'} body="Tasks are lines like “- [ ] Label the vials” in any note." />}
      <View style={{ gap: 18 }}>
        {[...groups].map(([id, items]) => (
          <View key={id} style={{ gap: 6 }}>
            <Text role="link" {...{ href: href({ name: 'note', id }) }} style={s.groupTitle}>
              {vault.meta(id)?.title}
            </Text>
            {items.map(({ task }) => (
              <Row key={task.offset} onPress={() => vault.toggleTask(id, task.offset)} role="checkbox" aria-checked={task.done} label={task.text} style={{ paddingLeft: 10 + task.depth * 10 }}>
                <View style={[s.check, task.done && s.checkOn]}>{task.done && <Icon name="check" size={12} color={v('on-accent')} strokeWidth={3} />}</View>
                <Txt variant="body" style={[{ flex: 1 }, task.done && { color: v('text-faint'), textDecorationLine: 'line-through' }]}>
                  {task.text.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_m, t, _a, alias) => alias ?? t)}
                </Txt>
              </Row>
            ))}
          </View>
        ))}
      </View>
    </Page>
  );
}

// ── search & tag ───────────────────────────────────────────────────────────
export function Search({ q }: { q: string }) {
  const vault = useVault();
  const [query, setQuery] = useState(q);
  const input = useRef<TextInput>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const t = setTimeout(() => navigate({ name: 'search', q: query }, true), 250);
    return () => clearTimeout(t);
  }, [query]);
  const results = useMemo(() => search(vault.list(), query), [query, vault.getVersion()]);
  return (
    <Page kicker="Search" title={query ? `“${query}”` : 'All notes'}>
      <Field
        ref={input}
        icon="search"
        value={query}
        onChangeText={setQuery}
        placeholder="Search words, #tags, or is:task…"
        aria-label="Search notes"
        autoCorrect={false}
        autoCapitalize="none"
        hint="Words must all match. Combine with #tag or is:pinned, is:task, is:journal."
      />
      <Txt variant="label" style={{ marginVertical: 16 }} role="status">
        {num(results.length)} {results.length === 1 ? 'note' : 'notes'}
      </Txt>
      <ResultList results={results} terms={terms(query)} />
    </Page>
  );
}

export function TagView({ tag }: { tag: string }) {
  const vault = useVault();
  const results = vault.list().filter((m) => !m.trashed && m.tags.includes(tag));
  return (
    <Page kicker="Tag" title={`#${tag}`}>
      <ResultList results={results.map((m) => ({ meta: m, line: m.body.split('\n').find((l) => l.toLowerCase().includes(`#${tag}`)) }))} terms={[`#${tag}`]} />
    </Page>
  );
}

const terms = (q: string) => q.toLowerCase().split(/\s+/).filter((t) => t && !t.startsWith('is:'));

function search(list: NoteMeta[], q: string) {
  const ts = terms(q);
  const flags = q.toLowerCase().match(/is:\w+/g) ?? [];
  return list
    .filter((m) => !m.trashed)
    .filter((m) => flags.every((f) => (f === 'is:pinned' ? m.pinned : f === 'is:journal' ? !!m.journal : f === 'is:task' ? /\[[ xX]\]/.test(m.body) : true)))
    .map((m) => {
      const hay = (m.title + '\n' + m.body).toLowerCase();
      if (!ts.every((t) => (t.startsWith('#') ? m.tags.includes(t.slice(1)) : hay.includes(t)))) return null;
      const score = ts.reduce((n, t) => n + (m.title.toLowerCase().includes(t) ? 10 : 1), 0);
      const line = m.body.split('\n').find((l) => ts.some((t) => l.toLowerCase().includes(t)));
      return { meta: m, line, score };
    })
    .filter((r): r is { meta: NoteMeta; line: string | undefined; score: number } => !!r)
    .sort((a, b) => b.score - a.score || b.meta.updated - a.meta.updated);
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <Text key={i} style={{ backgroundColor: v('accent-soft'), color: v('text'), borderRadius: 3 }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ResultList({ results, terms: ts }: { results: { meta: NoteMeta; line?: string }[]; terms: string[] }) {
  if (!results.length) return <Empty icon="search" title="No notes match" body="Try fewer words, or check the spelling. Search runs entirely on this device." />;
  return (
    <View style={{ gap: 4 }}>
      {results.map(({ meta, line }) => (
        <Row key={meta.id} href={href({ name: 'note', id: meta.id })} style={{ alignItems: 'flex-start', paddingVertical: 10 }}>
          <Icon name={meta.journal ? 'journal' : 'note'} size={15} color={v('text-faint')} />
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Txt variant="heading" numberOfLines={1}>
              <Highlight text={meta.title} terms={ts} />
            </Txt>
            <Txt variant="small" numberOfLines={2}>
              <Highlight text={(line ?? meta.excerpt).trim()} terms={ts} />
            </Txt>
          </View>
          <Txt variant="small" style={{ fontVariantNumeric: 'tabular-nums' } as object}>
            {relative(meta.updated)}
          </Txt>
        </Row>
      ))}
    </View>
  );
}

// ── oracle ─────────────────────────────────────────────────────────────────
const PROMPTS = [
  'What would you measure differently if you came back next season?',
  'Which observation here surprised you, and why?',
  'What is this note missing that your future self will need?',
  'Who else should see this, and what would they ask?',
  'If this changed by 20% next year, what would it mean?',
  'What did you assume here that you never checked?',
  'Which link from here is still unwritten?',
];

export function Oracle() {
  const vault = useVault();
  const { reduceMotion } = useTheme();
  const candidates = vault.list().filter((m) => !m.trashed && m.body.trim().length > 40);
  const [seed, setSeed] = useState(() => Math.random());
  const [spinning, setSpinning] = useState(false);

  // Weighted toward notes left alone the longest.
  const pick = useMemo(() => {
    if (!candidates.length) return undefined;
    const now = Date.now();
    const weights = candidates.map((m) => Math.sqrt(Math.max(1, now - m.updated)));
    let r = seed * weights.reduce((a, b) => a + b, 0);
    return candidates.find((_, i) => (r -= weights[i]) <= 0) ?? candidates[0];
  }, [seed, candidates.length]);
  const prompt = PROMPTS[Math.floor(seed * 997) % PROMPTS.length];

  const consult = () => {
    setSpinning(true);
    setTimeout(() => (setSeed(Math.random()), setSpinning(false)), reduceMotion ? 0 : 650);
  };

  return (
    <Page kicker="Delphi" title="The Oracle">
      <View style={s.oracle}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Laurel width={90} count={6} />
            <SunMark size={72} className={spinning ? 'fn-spin' : undefined} />
            <Laurel width={90} count={6} flip />
          </View>
          <Checker cells={14} size={9} />
          <Txt variant="italic" style={{ textAlign: 'center', maxWidth: 520, fontSize: 24, lineHeight: 32, color: v('text') }}>
            “{prompt}”
          </Txt>
        </View>
        {pick ? (
          <Card style={{ gap: 10, opacity: spinning ? 0.3 : 1, transitionProperty: 'opacity', transitionDuration: '300ms' } as object}>
            <Txt variant="label">
              Untouched for {relative(pick.updated).replace(/^in /, '')} · {num(pick.words)} words
            </Txt>
            <Text role="link" {...{ href: href({ name: 'note', id: pick.id }) }} style={s.oracleTitle}>
              {pick.title}
            </Text>
            <Preview id={pick.id} body={pick.body.split('\n').slice(0, 8).join('\n')} depth={1} />
          </Card>
        ) : (
          <Empty icon="oracle" title="The oracle needs more to read" body="Write a few notes and come back." />
        )}
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button kind="primary" icon="dice" label="Consult Again" loading={spinning} onPress={consult} />
          {pick && <Button icon="edit" label="Answer in the Note" onPress={() => navigate({ name: 'note', id: pick.id, view: 'edit' })} />}
        </View>
      </View>
    </Page>
  );
}

// ── trash ──────────────────────────────────────────────────────────────────
export function Trash() {
  const vault = useVault();
  const { toast } = useApp();
  const trashed = vault.list().filter((m) => m.trashed);
  return (
    <Page kicker={`${num(trashed.length)} notes`} title="Trash">
      <Txt variant="small" style={{ marginBottom: 16 }}>
        Trashed notes keep syncing, so restoring on any device brings them back everywhere.
      </Txt>
      {trashed.length === 0 && <Empty icon="trash" title="The trash is empty" body="Notes you move to the trash will wait here." />}
      {trashed.map((m) => (
        <Row key={m.id} href={href({ name: 'note', id: m.id })}>
          <Icon name="note" size={15} color={v('text-faint')} />
          <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {m.title}
          </Txt>
          <Button
            size="sm"
            icon="restore"
            label="Restore"
            onPress={() => {
              vault.setFlag(m.id, 'trashed', '0');
              toast({ title: `Restored “${m.title}”`, tone: 'success' });
            }}
          />
        </Row>
      ))}
    </Page>
  );
}

export function Empty({ icon, title, body }: { icon: 'journal' | 'tasks' | 'search' | 'oracle' | 'trash' | 'note'; title: string; body: string }) {
  return (
    <View style={s.empty}>
      <Icon name={icon} size={22} color={v('accent-ink')} />
      <Txt variant="heading">{title}</Txt>
      <Txt variant="small" style={{ textAlign: 'center', maxWidth: 360 }}>
        {body}
      </Txt>
    </View>
  );
}

export { Label };

const s = sx({
  page: { width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 40, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 18, flexWrap: 'wrap' },
  entryTitle: { fontFamily: font.serif, fontSize: 26, fontWeight: '600', color: v('text'), textDecorationLine: 'none' },
  groupTitle: { fontFamily: font.serif, fontSize: 21, fontWeight: '600', color: v('text'), textDecorationLine: 'none' },
  tabs: { flexDirection: 'row', gap: 4, marginBottom: 20 },
  tab: { paddingHorizontal: 14, minHeight: 32, justifyContent: 'center', borderRadius: 8, cursor: 'pointer' },
  tabOn: { backgroundColor: v('accent-soft') },
  tabText: { fontFamily: font.ui, fontSize: 13.5, fontWeight: '500', color: v('text-muted') },
  check: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: v('border-strong'), alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: v('accent'), borderColor: v('accent') },
  oracle: { gap: 28 },
  oracleTitle: { fontFamily: font.serif, fontSize: 30, fontWeight: '600', color: v('text'), textDecorationLine: 'none' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: v('border-strong') },
});
