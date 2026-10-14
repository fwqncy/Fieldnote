import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { num, useMedia } from '../hooks/app';
import { GraphScene, type GraphNode } from '../scenes/GraphScene';
import { useGraphData } from './graphData';
import { Icon } from '../ui/Icon';
import { Field, Label, Row, SwitchMark, Txt, sx, v } from '../ui/kit';

export function GraphView({ focus }: { focus?: string }) {
  const wide = useMedia('(min-width: 900px)');
  const [showTags, setShowTags] = useState(true);
  const [showOrphans, setShowOrphans] = useState(true);
  const [showMissing, setShowMissing] = useState(false);
  const [filter, setFilter] = useState('');
  const [hover, setHover] = useState<GraphNode | null>(null);
  const [listHot, setListHot] = useState<string | undefined>();

  const { nodes, links, open } = useGraphData({ tags: showTags, orphans: showOrphans, missing: showMissing });

  const q = filter.trim().toLowerCase();
  const listed = nodes.filter((n) => !q || n.title.toLowerCase().includes(q)).sort((a, b) => b.degree - a.degree);
  const highlight = listHot ?? (q && listed[0] ? listed[0].id : '');

  return (
    <View style={[s.root, !wide && { flexDirection: 'column' }]}>
      <View style={s.stage}>
        <GraphScene nodes={nodes} links={links} focus={focus} highlight={highlight} onOpen={open} onHover={setHover} />
        <View style={s.caption} pointerEvents="none">
          <Txt variant="label">Constellation</Txt>
          <Txt variant="display" style={{ fontSize: 34 }}>
            {num(nodes.filter((n) => n.kind === 'note').length)} stars, {num(links.length)} lines
          </Txt>
          <Txt variant="small">Drag to orbit · scroll to zoom · click a star to open it</Txt>
        </View>
        {hover && (
          <View style={s.hoverCard} pointerEvents="none" role="status">
            <Txt variant="heading">{hover.kind === 'tag' ? `#${hover.title}` : hover.title}</Txt>
            <Txt variant="small">
              {num(hover.degree)} {hover.degree === 1 ? 'link' : 'links'}
              {hover.kind === 'missing' ? ' · not written yet, click to create' : ''}
            </Txt>
          </View>
        )}
      </View>
      <View style={[s.side, !wide && s.sideNarrow]} role="complementary" aria-label="Graph controls">
        <Field icon="search" placeholder="Find a star…" value={filter} onChangeText={setFilter} aria-label="Filter graph" autoCorrect={false} />
        <View style={{ gap: 4 }}>
          <Toggle label="Tags as stars" value={showTags} onChange={setShowTags} />
          <Toggle label="Notes with no links" value={showOrphans} onChange={setShowOrphans} />
          <Toggle label="Unwritten links" value={showMissing} onChange={setShowMissing} />
        </View>
        <Label>Stars by brightness</Label>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2 }}>
          {listed.map((nd) => (
            <Row key={nd.id} onPress={() => open(nd)} onHoverIn={() => setListHot(nd.id)} onHoverOut={() => setListHot(undefined)} onFocus={() => setListHot(nd.id)} onBlur={() => setListHot(undefined)}>
              <Icon name={nd.kind === 'tag' ? 'hash' : nd.kind === 'missing' ? 'plus' : 'note'} size={14} color={nd.kind === 'tag' ? v('ground-ink') : v('text-muted')} />
              <Txt variant="body" numberOfLines={1} style={{ flex: 1, fontSize: 13.5 }}>
                {nd.title}
              </Txt>
              <Txt variant="mono" style={{ fontSize: 11.5, color: v('text-faint') }}>
                {nd.degree}
              </Txt>
            </Row>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row onPress={() => onChange(!value)} role="switch" aria-checked={value} label={label} style={{ justifyContent: 'space-between' }}>
      <Txt variant="small" style={{ color: v('text') }}>
        {label}
      </Txt>
      <SwitchMark on={value} />
    </Row>
  );
}

const s = sx({
  root: { flex: 1, flexDirection: 'row', minHeight: 0 },
  stage: { flex: 1, position: 'relative', minHeight: 360, backgroundImage: `radial-gradient(ellipse at 50% 40%, ${v('ground-soft')}, transparent 70%)` },
  caption: { position: 'absolute', top: 24, left: 28, gap: 4, maxWidth: 420 },
  hoverCard: { position: 'absolute', bottom: 24, left: 28, padding: 12, gap: 2, borderRadius: 12, backgroundColor: v('surface'), borderWidth: 1, borderColor: v('border-strong'), boxShadow: `0 12px 32px -8px ${v('shadow')}` },
  side: { width: 280, padding: 16, gap: 14, borderLeftWidth: 1, borderLeftColor: v('border'), backgroundColor: v('bg-elev') },
  sideNarrow: { width: '100%', height: 300, borderLeftWidth: 0, borderTopWidth: 1, borderTopColor: v('border') },
});
