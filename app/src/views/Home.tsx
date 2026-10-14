import gsap from 'gsap';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { duration, href, isoDate, navigate, num, relative, roman, useApp, useMedia, useSyncState, useVault } from '../hooks/app';
import { HeroScene } from '../scenes/HeroScene';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui/Icon';
import { Button, Card, Chip, Label, Row, Txt, font, sx, v } from '../ui/kit';
import { Checker, Laurel, Meander } from '../ui/Ornaments';
import { ColumnFrame, PILLAR_HEIGHT, Pillar } from '../ui/Pillar';
import { GraphScene } from '../scenes/GraphScene';
import { useGraphData } from './graphData';
import { PosterTitle } from '../ui/PosterTitle';

// Remembered for this browser session only, so every fresh launch opens
// with the full header.
const HERO_KEY = 'fieldnote:hero';
const readHero = () => {
  try {
    return sessionStorage.getItem(HERO_KEY) === 'min';
  } catch {
    return false;
  }
};

export function Home() {
  const vault = useVault();
  const sync = useSyncState();
  const { openPalette } = useApp();
  const { appearance, reduceMotion } = useTheme();
  const [collapsed, setCollapsed] = useState(readHero);
  // Which entrance to play after the next render; null on page load so a
  // restored state never animates or steals focus.
  const phase = useRef<'pillar-in' | 'hero-in' | null>(null);
  const busy = useRef(false);
  const heroRef = useRef<View>(null);
  const copyRef = useRef<View>(null);
  const minimizeRef = useRef<View>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const dom = (r: { current: unknown }) => r.current as HTMLElement | null;

  const setHero = (min: boolean) => {
    if (busy.current || min === collapsed) return;
    try {
      sessionStorage.setItem(HERO_KEY, min ? 'min' : 'max');
    } catch {
      /* private mode: just this view */
    }
    if (reduceMotion) {
      phase.current = min ? 'pillar-in' : 'hero-in';
      return setCollapsed(min);
    }
    busy.current = true;
    if (min) {
      // Copy lifts away, the scene dims, then the whole hero folds up to a bar.
      const el = dom(heroRef)!;
      const items = [...(dom(copyRef)?.children ?? [])];
      gsap
        .timeline({ onComplete: () => ((phase.current = 'pillar-in'), setCollapsed(true)) })
        .to(dom(minimizeRef), { opacity: 0, y: 12, duration: 0.2, ease: 'power2.in' }, 0)
        .to(items.slice().reverse(), { y: -28, opacity: 0, duration: 0.32, stagger: 0.035, ease: 'power2.in' }, 0)
        .to(el.firstElementChild, { opacity: 0, scale: 0.94, duration: 0.5, ease: 'power2.in' }, 0.1)
        .to(el, { height: PILLAR_HEIGHT, minHeight: 0, duration: 0.7, ease: 'power3.inOut' }, 0.25);
    } else {
      // The column rolls back up into its capital, then the hero unfolds.
      gsap
        .timeline({ onComplete: () => ((phase.current = 'hero-in'), setCollapsed(false)) })
        .to(['.fn-pillar-caption', '.fn-pillar-btn'], { opacity: 0, y: -8, duration: 0.2, stagger: 0.05, ease: 'power2.in' })
        .to('.fn-pillar-base', { x: -24, opacity: 0, duration: 0.3, ease: 'power2.in' }, '<0.05')
        .to('.fn-pillar-shaft', { scaleX: 0, transformOrigin: 'left center', duration: 0.45, ease: 'power3.in' }, '<')
        .to('.fn-pillar-cap', { opacity: 0, x: -12, duration: 0.2 }, '>-0.1');
    }
  };

  useLayoutEffect(() => {
    const which = phase.current;
    phase.current = null;
    if (!which) return;
    const done = () => {
      busy.current = false;
      if (which === 'pillar-in') expandRef.current?.focus();
      else dom(minimizeRef)?.focus();
    };
    if (reduceMotion) return done();

    if (which === 'pillar-in') {
      // Capital lands, the shaft rolls out, the base settles, the name is carved.
      gsap
        .timeline({ onComplete: done })
        .from('.fn-pillar-cap', { x: -40, opacity: 0, rotate: -8, duration: 0.45, ease: 'back.out(1.6)' })
        .from('.fn-pillar-shaft', { scaleX: 0, transformOrigin: 'left center', duration: 0.75, ease: 'power3.out' }, '-=0.2')
        .from('.fn-pillar-base', { x: -60, opacity: 0, duration: 0.5, ease: 'power3.out' }, '-=0.45')
        .from('.fn-pillar-caption', { opacity: 0, letterSpacing: '0.9em', duration: 0.7, ease: 'power3.out' }, '-=0.35')
        .from('.fn-pillar-btn', { opacity: 0, scale: 0.6, duration: 0.4, ease: 'back.out(2)' }, '-=0.4');
    } else {
      // Unfold from the bar to the hero's natural height, then bring the copy in.
      const el = dom(heroRef)!;
      const target = el.offsetHeight;
      const items = [...(dom(copyRef)?.children ?? [])];
      gsap
        .timeline({ onComplete: done })
        .fromTo(el, { height: PILLAR_HEIGHT, minHeight: 0 }, { height: target, duration: 0.8, ease: 'power3.inOut', clearProps: 'height,minHeight' })
        .from(el.firstElementChild, { opacity: 0, duration: 0.8, ease: 'power2.out' }, 0.2)
        .from(items, { y: 28, opacity: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out' }, 0.45)
        .from(dom(minimizeRef), { opacity: 0, y: 12, duration: 0.35, ease: 'power2.out' }, '-=0.2');
    }
  }, [collapsed]);
  const narrow = useMedia('(max-width: 720px)');
  const notes = vault.list().filter((m) => !m.trashed && !m.journal);
  const recent = notes.slice(0, 4);
  const now = new Date();

  const activity = useMemo(() => {
    const days = new Map<string, number>();
    for (const n of vault.notes.values()) for (const op of n.ops.values()) {
      const d = isoDate(new Date(op.ts));
      days.set(d, (days.get(d) ?? 0) + 1);
    }
    return days;
  }, [vault.getVersion()]);

  let streak = 0;
  for (let d = new Date(); activity.has(isoDate(d)); d.setDate(d.getDate() - 1)) streak++;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 64 }}>
      {collapsed ? (
        <Pillar ref={expandRef} onExpand={() => setHero(false)} caption={`Fieldnote · ${roman(now.getMonth() + 1)} · ${roman(now.getFullYear())}`} />
      ) : (
        <View ref={heroRef} style={[s.hero, narrow && { minHeight: 620 }]}>
          <HeroScene height="100%" leaves={appearance.leaves} />
          <View style={[s.heroShade, narrow && s.heroShadeNarrow]} pointerEvents="none" />
          <View ref={copyRef} style={[s.heroCopy, narrow && { paddingHorizontal: 20, paddingTop: 220 }]}>
            <Txt variant="label" style={{ color: v('text') }}>
              {roman(now.getMonth() + 1)} · {roman(now.getFullYear())}
            </Txt>
            <PosterTitle text="Fieldnote" />
            <View style={s.actions}>
              <Button kind="primary" label="New Note" icon="plus" onPress={() => navigate({ name: 'note', id: vault.create('Untitled', ''), view: 'edit' })} />
              <Button label="Today’s Entry" icon="journal" onPress={() => navigate({ name: 'note', id: vault.journal(isoDate()) })} />
              <Button kind="ghost" label="Commands" icon="command" onPress={() => openPalette()} />
            </View>
            <Txt variant="title" style={{ fontSize: 28, marginTop: 10 }}>
              Offline-first sync engine
            </Txt>
            <Txt variant="body" style={s.lede}>
              CRDT-based note sync for field researchers working without signal for days at a time, with conflict-free merges on reconnect.
            </Txt>
            <View style={s.quote}>
              <Txt variant="italic" style={{ color: v('text'), fontSize: 21, lineHeight: 29 }}>
                Designed so notes edited offline on more than one device merge cleanly on reconnect, without losing changes.
              </Txt>
            </View>
            <View style={s.chips}>
              {['Rust', 'SQLite', 'React Native'].map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          </View>
          <View style={s.minimizeWrap}>
            <Button ref={minimizeRef} size="sm" kind="secondary" icon="chevronUp" label="Minimize" aria-label="Minimize the header into a pillar" aria-expanded onPress={() => setHero(true)} style={s.minimize} />
          </View>
        </View>
      )}

      <Meander height={14} style={{ opacity: 0.9 }} />

      <View style={[s.grid, narrow && { paddingHorizontal: 16 }]}>
        <View style={[s.col, { flexGrow: 1.4 }]}>
          <Label roman="I">Field Notes</Label>
          <ColumnFrame label="Recent field notes">
            <Txt variant="heading" style={{ fontSize: 17, marginBottom: 4 }}>
              Field notes
            </Txt>
            {recent.map((m) => (
              <Pressable key={m.id} role="link" {...{ href: href({ name: 'note', id: m.id }) }} style={(st) => [s.noteCard, (st as { hovered?: boolean }).hovered && s.noteCardHover]}>
                <Text style={s.noteTitle} numberOfLines={1}>
                  {m.title}
                </Text>
                <Text style={s.noteExcerpt} numberOfLines={1}>
                  {m.excerpt || 'Empty note'}
                </Text>
              </Pressable>
            ))}
            <View style={[s.syncPill, sync.status === 'offline' || sync.status === 'expedition' ? s.syncPillOff : null]} role="status">
              <Text style={s.syncPillText}>
                {sync.status === 'expedition'
                  ? `Expedition mode · ${num(sync.queued)} ops waiting`
                  : sync.status === 'offline'
                    ? `Offline${sync.offlineSince ? ` for ${duration(Date.now() - sync.offlineSince)}` : ''} · ${num(sync.queued)} ops queued`
                    : sync.lastSync
                      ? `Synced ${relative(sync.lastSync)} · 0 conflicts`
                      : 'Saved on this device · 0 conflicts'}
              </Text>
            </View>
          </ColumnFrame>
        </View>

        <View style={s.col}>
          <Label roman="II">Field Days</Label>
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Laurel width={70} count={7} filled={Math.min(7, streak)} />
              <View style={{ flex: 1 }}>
                <Txt variant="title" style={{ fontSize: 24 }}>
                  {streak ? `${num(streak)}-day streak` : 'No streak yet'}
                </Txt>
                <Txt variant="small">{streak ? 'A leaf for every day you wrote, up to seven.' : 'Write something today to earn your first leaf.'}</Txt>
              </View>
              <Laurel width={70} count={7} flip filled={Math.min(7, streak)} />
            </View>
            <Heatmap activity={activity} />
          </Card>

          <Label roman="III" style={{ marginTop: 12 }}>
            The Oracle
          </Label>
          <Card style={{ gap: 10, backgroundColor: v('ground'), borderColor: v('accent-line') }}>
            <Checker cells={10} size={8} />
            <Txt variant="title" style={{ color: v('on-ground'), fontSize: 24 }}>
              Consult the oracle at Delphi
            </Txt>
            <Txt variant="small" style={{ color: v('on-ground'), opacity: 0.85 }}>
              It resurfaces a note you haven’t touched in a while, with a question to take back into the field.
            </Txt>
            <Button kind="primary" label="Ask the Oracle" icon="oracle" onPress={() => navigate({ name: 'oracle' })} style={{ alignSelf: 'flex-start' }} />
          </Card>

          <Label roman="IV" style={{ marginTop: 12 }}>
            Vault
          </Label>
          <Card style={{ gap: 2, padding: 6 }}>
            <Stat icon="note" label="Notes" value={num(notes.length)} to={href({ name: 'search', q: '' })} />
            <Stat icon="hash" label="Tags" value={num(vault.index().tags.size)} to={href({ name: 'graph' })} />
            <Stat icon="tasks" label="Open tasks" value={num(vault.index().tasks.filter((t) => !t.task.done).length)} to={href({ name: 'tasks' })} />
            <Stat icon="sync" label="Ops waiting for signal" value={num(sync.queued)} to={href({ name: 'settings' })} />
          </Card>
        </View>
      </View>

      <ConstellationSection narrow={narrow} />
    </ScrollView>
  );
}

function ConstellationSection({ narrow }: { narrow: boolean }) {
  const { nodes, links, open } = useGraphData();
  const notes = nodes.filter((n) => n.kind === 'note');
  const brightest = [...notes].sort((a, b) => b.degree - a.degree).slice(0, 5);
  const lonely = notes.filter((n) => n.degree === 0).length;
  return (
    <View style={[s.constellation, narrow && { paddingHorizontal: 16 }]}>
      <Label roman="V">Constellation</Label>
      <View style={[s.skyCard, narrow && { flexDirection: 'column' }]}>
        <View style={[s.sky, narrow && { minHeight: 300 }]}>
          <GraphScene nodes={nodes} links={links} onOpen={open} compact />
        </View>
        <View style={[s.skyInfo, narrow && { width: '100%', borderLeftWidth: 0, borderTopWidth: 1, borderTopColor: v('border') }]}>
          <Txt variant="display" style={{ fontSize: 32, lineHeight: 36 }}>
            {num(notes.length)} stars, {num(links.length)} lines
          </Txt>
          <Txt variant="small">Every note is a star; every link draws a line. Drag the sky to turn it, or click a star to open its note.</Txt>
          <Txt variant="label" style={{ marginTop: 6 }}>
            Brightest Stars
          </Txt>
          <View style={{ gap: 2, marginHorizontal: -10 }}>
            {brightest.map((n) => (
              <Row key={n.id} href={href({ name: 'note', id: n.id })} style={{ minHeight: 32 }}>
                <Icon name="oracle" size={13} color={v('accent-ink')} />
                <Txt variant="body" numberOfLines={1} style={{ flex: 1, fontSize: 13.5 }}>
                  {n.title}
                </Txt>
                <Txt variant="mono" style={{ fontSize: 11.5, color: v('text-faint') }}>
                  {num(n.degree)}
                </Txt>
              </Row>
            ))}
          </View>
          {lonely > 0 && (
            <Txt variant="small">
              {num(lonely)} {lonely === 1 ? 'star shines' : 'stars shine'} alone, with no links yet.
            </Txt>
          )}
          <Button kind="primary" icon="graph" label="Open Constellation" onPress={() => navigate({ name: 'graph' })} style={{ alignSelf: 'flex-start', marginTop: 'auto' }} />
        </View>
      </View>
    </View>
  );
}

function Stat({ icon, label, value, to }: { icon: 'note' | 'hash' | 'tasks' | 'sync'; label: string; value: string; to: string }) {
  return (
    <Row href={to} style={{ minHeight: 40 }}>
      <Icon name={icon} size={15} color={v('accent-ink')} />
      <Txt variant="body" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt variant="mono">{value}</Txt>
    </Row>
  );
}

function Heatmap({ activity }: { activity: Map<string, number> }) {
  const weeks = 18;
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1) - today.getDay());
  const cols: { date: string; n: number }[][] = [];
  for (let w = 0; w < weeks + 1; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      if (day > today) break;
      const iso = isoDate(day);
      col.push({ date: iso, n: activity.get(iso) ?? 0 });
    }
    cols.push(col);
  }
  const max = Math.max(1, ...activity.values());
  const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  return (
    <View role="img" aria-label={`Writing activity over the last ${weeks} weeks`} style={{ flexDirection: 'row', gap: 3, flexWrap: 'nowrap', overflow: 'hidden' }}>
      {cols.map((col, i) => (
        <View key={i} style={{ gap: 3 }}>
          {col.map((c) => (
            <View
              key={c.date}
              {...{ title: `${fmt.format(new Date(c.date + 'T12:00'))}: ${c.n} ops` }}
              style={{ width: 11, height: 11, borderRadius: 2.5, backgroundColor: c.n ? v('accent') : v('surface-2'), opacity: c.n ? 0.3 + 0.7 * Math.sqrt(c.n / max) : 1 }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const s = sx({
  hero: { position: 'relative', minHeight: 560, justifyContent: 'center', overflow: 'hidden', backgroundColor: v('bg') },
  heroShade: { position: 'absolute', inset: 0, backgroundImage: `linear-gradient(90deg, ${v('bg')} 12%, rgba(0,0,0,0) 58%), linear-gradient(0deg, ${v('bg')} 0%, rgba(0,0,0,0) 30%)` },
  heroShadeNarrow: { backgroundImage: `linear-gradient(0deg, ${v('bg')} 42%, rgba(0,0,0,0) 78%)` },
  heroCopy: { maxWidth: 610, paddingHorizontal: 48, paddingVertical: 56, gap: 12 },
  lede: { fontSize: 17, lineHeight: 27, color: v('text-muted'), maxWidth: 560 },
  quote: { borderLeftWidth: 2, borderLeftColor: v('accent'), paddingLeft: 18, marginTop: 4, maxWidth: 560 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 6 },
  minimizeWrap: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center', pointerEvents: 'box-none' },
  minimize: { backdropFilter: 'blur(6px)', backgroundColor: v('surface') },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, paddingHorizontal: 48, paddingTop: 36, maxWidth: 1240 },
  col: { flexGrow: 1, flexBasis: 340, gap: 12, minWidth: 0 },
  constellation: { paddingHorizontal: 48, paddingTop: 40, maxWidth: 1240, gap: 12 },
  skyCard: { flexDirection: 'row', minHeight: 440, borderRadius: 16, borderWidth: 1, borderColor: v('border'), overflow: 'hidden', backgroundColor: v('bg'), backgroundImage: `radial-gradient(ellipse at 40% 45%, ${v('ground-soft')}, transparent 70%)`, boxShadow: `0 24px 48px -24px ${v('shadow')}` },
  sky: { flex: 1, position: 'relative', minHeight: 440 },
  skyInfo: { width: 300, padding: 20, gap: 10, borderLeftWidth: 1, borderLeftColor: v('border'), backgroundColor: v('bg-elev') },
  noteCard: { padding: 12, borderRadius: 12, backgroundColor: v('surface-2'), gap: 3, textDecorationLine: 'none', transitionProperty: 'background-color, transform', transitionDuration: '160ms' },
  noteCardHover: { backgroundColor: v('surface-3'), transform: [{ translateY: -1 }] },
  noteTitle: { fontFamily: font.ui, fontSize: 15.5, fontWeight: '500', color: v('text') },
  noteExcerpt: { fontFamily: font.ui, fontSize: 13.5, color: v('text-muted') },
  syncPill: { marginTop: 'auto', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: v('success'), backgroundColor: v('success-soft') },
  syncPillOff: { borderColor: v('accent-line'), backgroundColor: v('accent-soft') },
  syncPillText: { fontFamily: font.ui, fontSize: 13, lineHeight: 19, color: v('text') },
});
