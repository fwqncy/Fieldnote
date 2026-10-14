// Markdown → React Native. Supports the Obsidian dialect people expect:
// [[wikilinks|alias]], ![[embeds]], #tags, ==highlights==, > [!callouts],
// - [ ] tasks (clickable), tables and fenced code.

import { Fragment, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { href, navigate, useApp } from '../hooks/app';
import { Icon, type IconName } from '../ui/Icon';
import { font, sx, v } from '../ui/kit';

type Props = { id: string; body: string; depth?: number };

export function Preview({ id, body, depth = 0 }: Props) {
  const { vault } = useApp();
  const lines = body.split('\n');
  const offsets: number[] = [];
  lines.reduce((acc, l) => (offsets.push(acc), acc + l.length + 1), 0);

  const blocks: ReactNode[] = [];
  let i = 0;
  const inline = (s: string) => <Inline text={s} />;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(
        <View key={key} style={s.code}>
          {lang ? <Text style={s.codeLang}>{lang}</Text> : null}
          <ScrollView horizontal>
            <Text style={s.codeText} selectable>
              {code.join('\n')}
            </Text>
          </ScrollView>
        </View>,
      );
      continue;
    }

    const h = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <Text key={key} nativeID={`h-${id}-${i}`} role="heading" aria-level={Math.min(level + 1, 6)} style={[s.h, hList[Math.min(level, 4) - 1], { scrollMarginTop: 24 } as object]}>
          {inline(h[2])}
        </Text>,
      );
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<View key={key} role="separator" style={s.hr} />);
      i++;
      continue;
    }

    const embed = /^!\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]\s*$/.exec(line);
    if (embed) {
      blocks.push(<Embed key={key} title={embed[1].trim()} depth={depth} />);
      i++;
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const rows: string[][] = [];
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      rows.push(cells(line));
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <ScrollView key={key} horizontal style={s.tableWrap} contentContainerStyle={{ flexGrow: 1 }}>
          <View role="table" style={s.table}>
            {rows.map((r, ri) => (
              <View key={ri} role="row" style={[s.tr, ri === 0 && s.thead, ri === rows.length - 1 && { borderBottomWidth: 0 }]}>
                {r.map((c, ci) => (
                  <Text key={ci} role={ri === 0 ? 'columnheader' : 'cell'} style={[s.td, ri === 0 && s.th]}>
                    {inline(c)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>,
      );
      continue;
    }

    if (/^>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      const callout = /^\[!(\w+)\]\s*(.*)$/.exec(quote[0]);
      if (callout) {
        const kind = callout[1].toLowerCase();
        const c = callouts[kind] ?? callouts.note;
        blocks.push(
          <View key={key} role="note" style={[s.callout, { borderColor: c.color, backgroundColor: c.bg }]}>
            <View style={s.calloutHead}>
              <Icon name={c.icon} size={15} color={c.color} />
              <Text style={[s.calloutTitle, { color: c.color }]}>{callout[2] || kind[0].toUpperCase() + kind.slice(1)}</Text>
            </View>
            {quote.slice(1).map((q, qi) => (
              <Text key={qi} style={s.p}>
                {inline(q)}
              </Text>
            ))}
          </View>,
        );
      } else {
        blocks.push(
          <View key={key} style={s.quote}>
            {quote.map((q, qi) => (
              <Text key={qi} style={s.quoteText}>
                {inline(q)}
              </Text>
            ))}
          </View>,
        );
      }
      continue;
    }

    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const l = lines[i];
        const m = /^(\s*)([-*+]|\d+[.)])\s+(\[( |x|X)\]\s+)?(.*)$/.exec(l)!;
        const depthPad = Math.floor(m[1].replace(/\t/g, '  ').length / 2) * 22;
        const isTask = !!m[3];
        const done = isTask && m[4] !== ' ';
        const offset = offsets[i] + l.indexOf('[') + 1;
        items.push(
          <View key={i} style={[s.li, { paddingLeft: depthPad }]}>
            {isTask ? (
              <Pressable
                role="checkbox"
                aria-checked={done}
                aria-label={m[5]}
                disabled={depth > 0}
                onPress={() => vault.toggleTask(id, offset)}
                style={(st) => [s.check, done && s.checkOn, (st as { hovered?: boolean }).hovered && { borderColor: v('accent') }]}
                hitSlop={6}
              >
                {done && <Icon name="check" size={12} color={v('on-accent')} strokeWidth={3} />}
              </Pressable>
            ) : (
              <Text style={s.bullet} aria-hidden>
                {/\d/.test(m[2]) ? m[2] : '•'}
              </Text>
            )}
            <Text style={[s.p, { flex: 1 }, done && s.done]}>{inline(m[5])}</Text>
          </View>,
        );
        i++;
      }
      blocks.push(
        <View key={key} role="list" style={s.list}>
          {items}
        </View>,
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s|!\[\[|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    blocks.push(
      <Text key={key} style={s.p} selectable>
        {para.map((p, pi) => (
          <Fragment key={pi}>
            {pi > 0 && '\n'}
            {inline(p)}
          </Fragment>
        ))}
      </Text>,
    );
  }

  return <View style={{ gap: 12 }}>{blocks}</View>;
}

const INLINE = /(!?\[\[[^\]\n]+\]\])|(\*\*[^*\n]+\*\*)|(\*[^*\s\n][^*\n]*\*)|(`[^`\n]+`)|(~~[^~\n]+~~)|(==[^=\n]+==)|(\[[^\]\n]+\]\([^)\s]+\))|((?:^|(?<=[\s(]))#[\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)|(https?:\/\/[^\s)]+)/gu;

function Inline({ text }: { text: string }) {
  const { vault } = useApp();
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const key = k++;
    if (m[1]) {
      const inner = t.replace(/^!/, '').slice(2, -2);
      const [target, alias] = inner.split('|');
      const title = target.split('#')[0].trim();
      const id = vault.resolve(title);
      out.push(
        id ? (
          <Text key={key} role="link" {...{ href: href({ name: 'note', id }) }} style={s.wikilink}>
            {alias ?? target}
          </Text>
        ) : (
          <Text
            key={key}
            role="link"
            aria-label={`Create note “${title}”`}
            onPress={() => navigate({ name: 'note', id: vault.create(title, '') })}
            style={[s.wikilink, s.unresolved]}
          >
            {alias ?? target}
          </Text>
        ),
      );
    } else if (m[2]) out.push(<Text key={key} style={{ fontWeight: '700' }}><Inline text={t.slice(2, -2)} /></Text>);
    else if (m[3]) out.push(<Text key={key} style={{ fontStyle: 'italic' }}><Inline text={t.slice(1, -1)} /></Text>);
    else if (m[4]) out.push(<Text key={key} style={s.inlineCode}>{t.slice(1, -1)}</Text>);
    else if (m[5]) out.push(<Text key={key} style={{ textDecorationLine: 'line-through', color: v('text-muted') }}><Inline text={t.slice(2, -2)} /></Text>);
    else if (m[6]) out.push(<Text key={key} style={s.mark}><Inline text={t.slice(2, -2)} /></Text>);
    else if (m[7]) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!;
      out.push(<Text key={key} role="link" {...{ href: lm[2], hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }} style={s.extLink}>{lm[1]}</Text>);
    } else if (m[8]) {
      const tag = t.slice(1).toLowerCase();
      out.push(<Text key={key} role="link" {...{ href: href({ name: 'tag', tag }) }} style={s.tag}>{t}</Text>);
    } else if (m[9]) {
      out.push(<Text key={key} role="link" {...{ href: t, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }} style={s.extLink}>{t}</Text>);
    }
    last = m.index! + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

function Embed({ title, depth }: { title: string; depth: number }) {
  const { vault } = useApp();
  const id = vault.resolve(title);
  const meta = id ? vault.meta(id) : undefined;
  return (
    <View style={s.embed}>
      <View style={s.embedHead}>
        <Icon name="note" size={14} color={v('accent-ink')} />
        {meta ? (
          <Text role="link" {...{ href: href({ name: 'note', id: meta.id }) }} style={s.embedTitle}>
            {meta.title}
          </Text>
        ) : (
          <Text style={[s.embedTitle, { color: v('text-faint') }]}>“{title}” hasn’t been written yet</Text>
        )}
      </View>
      {meta && (depth < 1 ? <Preview id={meta.id} body={meta.body} depth={depth + 1} /> : <Text style={s.p}>{meta.excerpt}</Text>)}
    </View>
  );
}

const callouts: Record<string, { icon: IconName; color: string; bg: string }> = {
  note: { icon: 'info', color: v('ground-ink'), bg: v('ground-soft') },
  info: { icon: 'info', color: v('ground-ink'), bg: v('ground-soft') },
  tip: { icon: 'leaf', color: v('accent-ink'), bg: v('accent-soft') },
  warning: { icon: 'info', color: v('danger'), bg: v('danger-soft') },
  danger: { icon: 'info', color: v('danger'), bg: v('danger-soft') },
  success: { icon: 'check', color: v('success'), bg: v('success-soft') },
  quote: { icon: 'scroll', color: v('text-muted'), bg: v('surface-2') },
};

const hStyles = sx({
  h1: { fontFamily: font.serif, fontSize: 34, lineHeight: 40, fontWeight: '600', marginTop: 8 },
  h2: { fontFamily: font.serif, fontSize: 26, lineHeight: 32, fontWeight: '600', marginTop: 10 },
  h3: { fontFamily: font.ui, fontSize: 17, lineHeight: 24, fontWeight: '600', marginTop: 6 },
  h4: { fontFamily: font.mono, fontSize: 12, lineHeight: 18, letterSpacing: 1.5, textTransform: 'uppercase', color: v('text-muted') },
});
const hList = [hStyles.h1, hStyles.h2, hStyles.h3, hStyles.h4];

const s = sx({
  h: { color: v('text') },
  p: { fontFamily: font.ui, fontSize: 15.5, lineHeight: 26, color: v('text') },
  done: { color: v('text-faint'), textDecorationLine: 'line-through' },
  hr: { height: 1, backgroundColor: v('border'), marginVertical: 8 },
  list: { gap: 4 },
  li: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 18, textAlign: 'right', color: v('accent-ink'), fontFamily: font.mono, fontSize: 14, lineHeight: 26 },
  check: { width: 18, height: 18, marginTop: 4, borderRadius: 5, borderWidth: 1.5, borderColor: v('border-strong'), alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '120ms' },
  checkOn: { backgroundColor: v('accent'), borderColor: v('accent') },
  quote: { borderLeftWidth: 2, borderLeftColor: v('accent'), paddingLeft: 16, paddingVertical: 2 },
  quoteText: { fontFamily: font.serif, fontStyle: 'italic', fontSize: 20, lineHeight: 30, color: v('text') },
  callout: { borderLeftWidth: 3, borderRadius: 10, padding: 14, gap: 6 },
  calloutHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calloutTitle: { fontFamily: font.ui, fontWeight: '600', fontSize: 14 },
  code: { backgroundColor: v('bg'), borderWidth: 1, borderColor: v('border'), borderRadius: 10, padding: 14, gap: 6 },
  codeLang: { fontFamily: font.mono, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: v('text-faint') },
  codeText: { fontFamily: font.mono, fontSize: 13, lineHeight: 21, color: v('text') },
  inlineCode: { fontFamily: font.mono, fontSize: 13.5, backgroundColor: v('surface-2'), color: v('accent-ink'), paddingHorizontal: 5, borderRadius: 4 },
  mark: { backgroundColor: v('accent-soft'), color: v('text'), paddingHorizontal: 2, borderRadius: 3 },
  wikilink: { color: v('accent-ink'), textDecorationLine: 'underline', textDecorationColor: v('accent-line'), textUnderlineOffset: 3, cursor: 'pointer' },
  unresolved: { textDecorationStyle: 'dashed', opacity: 0.8 },
  extLink: { color: v('ground-ink'), textDecorationLine: 'underline', textUnderlineOffset: 3 },
  tag: { fontFamily: font.mono, fontSize: 13, color: v('ground-ink'), backgroundColor: v('ground-soft'), paddingHorizontal: 6, borderRadius: 999, textDecorationLine: 'none' },
  tableWrap: { borderWidth: 1, borderColor: v('border'), borderRadius: 10 },
  table: { flexGrow: 1, minWidth: '100%' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: v('border') },
  thead: { backgroundColor: v('surface-2') },
  td: { flex: 1, minWidth: 90, paddingHorizontal: 12, paddingVertical: 8, fontFamily: font.ui, fontSize: 14, color: v('text'), fontVariantNumeric: 'tabular-nums' },
  th: { fontWeight: '600', fontSize: 12.5, color: v('text-muted') },
  embed: { borderWidth: 1, borderColor: v('border'), borderLeftWidth: 3, borderLeftColor: v('accent-line'), borderRadius: 10, padding: 14, gap: 10, backgroundColor: v('surface') },
  embedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  embedTitle: { fontFamily: font.serif, fontSize: 19, fontWeight: '600', color: v('text'), textDecorationLine: 'none' },
});
