import { ScrollView, Text, View } from 'react-native';
import { href, navigate, num, relative, useMedia, useVault } from '../hooks/app';
import { escapeRegExp, headings } from '../store/markdown';
import { Icon } from '../ui/Icon';
import { Button, Divider, Label, Row, Txt, font, sx, v } from '../ui/kit';
import { replicaColor } from '../views/replicaColor';

export function NotePanel({ id, onClose }: { id: string; onClose: () => void }) {
  const vault = useVault();
  const meta = vault.meta(id);
  const overlay = !useMedia('(min-width: 1180px)');
  if (!meta) return null;
  const index = vault.index();
  const backlinks = index.backlinks.get(id) ?? [];
  const mentions = vault.unlinkedMentions(id);
  const outline = headings(meta.body);
  const outgoing = index.outgoing.get(id) ?? [];
  const note = vault.notes.get(id)!;
  const names = vault.deviceNames();

  const byDevice = new Map<string, number>();
  for (const op of note.ops.values()) byDevice.set(op.id.replica, (byDevice.get(op.id.replica) ?? 0) + 1);
  const devices = [...byDevice.entries()].sort((a, b) => b[1] - a[1]);

  const linkMention = (from: string) => {
    const other = vault.meta(from);
    if (!other) return;
    const plain = new RegExp(`(?<!\\[\\[)\\b(${escapeRegExp(meta.title)})\\b(?![^\\[]*\\]\\])`, 'i');
    vault.editBody(from, other.body.replace(plain, `[[${meta.title}]]`));
  };

  const jump = (line: number) => {
    const el = document.getElementById(`h-${id}-${line}`);
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    else {
      navigate({ name: 'note', id, view: 'read' }, true);
      requestAnimationFrame(() => setTimeout(() => document.getElementById(`h-${id}-${line}`)?.scrollIntoView({ block: 'start' }), 60));
    }
  };

  return (
    <View role="complementary" aria-label="Note details" style={[s.panel, overlay && s.overlay]}>
      <View style={s.head}>
        <Txt variant="heading" style={{ flex: 1 }}>
          Details
        </Txt>
        <Button size="sm" kind="ghost" hideLabel label="Close details" icon="close" onPress={onClose} />
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Section roman="I" title={`Backlinks · ${backlinks.length}`}>
          {backlinks.length ? (
            backlinks.map((b) => (
              <Row key={b.from} href={href({ name: 'note', id: b.from })} style={s.linkRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="heading" numberOfLines={1} style={{ fontSize: 13.5 }}>
                    {vault.meta(b.from)?.title}
                  </Txt>
                  {b.lines.slice(0, 2).map((l, i) => (
                    <Txt key={i} variant="small" numberOfLines={2}>
                      {l}
                    </Txt>
                  ))}
                </View>
              </Row>
            ))
          ) : (
            <Txt variant="small">No notes link here yet. Type [[{meta.title}]] in another note to link it.</Txt>
          )}
        </Section>

        {mentions.length > 0 && (
          <Section roman="II" title={`Unlinked Mentions · ${mentions.length}`}>
            {mentions.map((m) => (
              <View key={m.from} style={s.mention}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text role="link" {...{ href: href({ name: 'note', id: m.from }) }} style={s.mentionTitle} numberOfLines={1}>
                    {vault.meta(m.from)?.title}
                  </Text>
                  <Txt variant="small" numberOfLines={2}>
                    {m.lines[0]}
                  </Txt>
                </View>
                <Button size="sm" label="Link" icon="link" onPress={() => linkMention(m.from)} />
              </View>
            ))}
          </Section>
        )}

        <Section roman={mentions.length ? 'III' : 'II'} title="Outline">
          {outline.length ? (
            outline.map((h) => (
              <Row key={h.line} onPress={() => jump(h.line)} style={{ paddingLeft: 10 + (h.level - 1) * 14, minHeight: 28 }}>
                <Txt variant="small" numberOfLines={1} style={{ color: h.level === 1 ? v('text') : v('text-muted') }}>
                  {h.text}
                </Txt>
              </Row>
            ))
          ) : (
            <Txt variant="small">Add headings with # to build an outline.</Txt>
          )}
        </Section>

        <Section roman={mentions.length ? 'IV' : 'III'} title="Provenance">
          <View style={s.facts}>
            <Fact k="Created" v={relative(meta.created)} />
            <Fact k="Edited" v={relative(meta.updated)} />
            <Fact k="Operations" v={num(meta.ops)} />
            <Fact k="Lamport time" v={num(note.lamport)} />
            <Fact k="Links out" v={num(outgoing.length)} />
          </View>
          <Txt variant="label" style={{ marginTop: 10 }}>
            Written On
          </Txt>
          {devices.map(([r, n]) => (
            <View key={r} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Txt variant="small" numberOfLines={1} style={{ color: v('text'), flex: 1 }}>
                  {names.get(r) ?? `Device ${r.slice(0, 6)}`}
                  {r === vault.replica ? ' (this device)' : ''}
                </Txt>
                <Txt variant="mono" style={{ fontSize: 11.5, color: v('text-muted') }}>
                  {num(n)}
                </Txt>
              </View>
              <View style={s.bar}>
                <View style={{ width: `${(n / note.ops.size) * 100}%`, height: '100%', borderRadius: 2, backgroundColor: replicaColor(r, vault.replica) }} />
              </View>
            </View>
          ))}
          <Button size="sm" label="See It as a Palimpsest" icon="layers" onPress={() => navigate({ name: 'note', id, layer: 'palimpsest' }, true)} style={{ marginTop: 6, alignSelf: 'flex-start' }} />
        </Section>

        <Divider />
        <Row href={href({ name: 'graph', focus: id })} style={{ minHeight: 36 }}>
          <Icon name="graph" size={15} color={v('accent-ink')} />
          <Txt variant="small" style={{ color: v('text'), flex: 1 }}>
            Show in Constellation
          </Txt>
          <Icon name="chevronRight" size={14} color={v('text-faint')} />
        </Row>
      </ScrollView>
    </View>
  );
}

function Section({ roman, title, children }: { roman: string; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Label roman={roman}>{title}</Label>
      {children}
    </View>
  );
}

function Fact({ k, v: value }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Txt variant="small">{k}</Txt>
      <Txt variant="mono" style={{ fontSize: 12 }}>
        {value}
      </Txt>
    </View>
  );
}

const s = sx({
  panel: { width: 300, borderLeftWidth: 1, borderLeftColor: v('border'), backgroundColor: v('bg-elev') },
  overlay: { position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 20, width: 'min(340px, 92vw)', boxShadow: `-24px 0 48px -16px ${v('shadow')}` },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: v('border') },
  body: { padding: 16, gap: 24, paddingBottom: 48 },
  linkRow: { alignItems: 'flex-start', paddingVertical: 8, marginHorizontal: -10 },
  mention: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mentionTitle: { fontFamily: font.ui, fontSize: 13.5, fontWeight: '600', color: v('text'), textDecorationLine: 'none' },
  facts: { gap: 6 },
  bar: { height: 4, borderRadius: 2, backgroundColor: v('surface-2'), overflow: 'hidden' },
});
