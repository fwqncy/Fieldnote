import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LocalDB, deviceSlot } from '../store/db';
import { num, relative, useApp, useSyncState, useVault } from '../hooks/app';
import { contrast, ensureContrast, isHex, normalizeHex } from '../theme/color';
import { SCHEMES, deriveTokens, type SchemeId } from '../theme/schemes';
import { useTheme, type Motion } from '../theme/ThemeProvider';
import { ColorWheel } from '../ui/ColorWheel';
import { Icon } from '../ui/Icon';
import { Button, Card, Field, Label, SwitchMark, Txt, font, sx, v } from '../ui/kit';
import { Meander } from '../ui/Ornaments';

const SUGGESTIONS = [
  { name: 'Laurel', hex: '#5d8a4e' },
  { name: 'Aegean', hex: '#2c7da0' },
  { name: 'Terracotta', hex: '#c8643b' },
  { name: 'Porphyry', hex: '#7b3f8c' },
  { name: 'Olive', hex: '#8a8a2c' },
  { name: 'Marble', hex: '#cfc8b8' },
];

export function Settings() {
  useEffect(() => {
    document.title = 'Settings · Fieldnote';
  }, []);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.page}>
      <Txt variant="label" tone="accent">
        Preferences
      </Txt>
      <Txt variant="display" role="heading" aria-level={1}>
        Settings
      </Txt>
      <Meander height={12} style={{ marginTop: 14, marginBottom: 28, opacity: 0.7 }} />
      <Appearance />
      <SyncSettings />
      <DataSettings />
    </ScrollView>
  );
}

function Appearance() {
  const { appearance, update, dark, seeds, tokens } = useTheme();
  const [target, setTarget] = useState<'accent' | 'ground'>('accent');
  const [hexDraft, setHexDraft] = useState(seeds[target]);
  const [hexError, setHexError] = useState<string>();
  useEffect(() => (setHexDraft(seeds[target]), setHexError(undefined)), [seeds.accent, seeds.ground, target]);

  const setCustom = (hex: string) => update({ scheme: 'custom', custom: { ...seeds, [target]: hex } });
  const commitHex = () => {
    if (!isHex(hexDraft)) return setHexError('Use a hex colour like #e8b224.');
    setHexError(undefined);
    setCustom(normalizeHex(hexDraft));
  };
  const pickFromScreen = async () => {
    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!ED) return;
    try {
      setCustom((await new ED().open()).sRGBHex);
    } catch {
      /* cancelled */
    }
  };

  const schemes: { id: SchemeId; name: string; blurb: string; accent: string; ground: string }[] = [
    ...Object.entries(SCHEMES).map(([id, sc]) => ({ id: id as SchemeId, name: sc.name, blurb: sc.blurb, ...sc.seeds })),
    { id: 'custom', name: 'Your Colours', blurb: 'Anything on the wheel', ...appearance.custom },
  ];
  const ratio = contrast(tokens['accent-ink'], tokens.surface);

  return (
    <Section roman="I" title="Appearance">
      <Txt variant="heading">Colour scheme</Txt>
      <View role="radiogroup" aria-label="Colour scheme" style={s.schemes}>
        {schemes.map((sc) => {
          const on = appearance.scheme === sc.id;
          const t = deriveTokens(sc, dark);
          return (
            <Pressable key={sc.id} role="radio" aria-checked={on} onPress={() => update({ scheme: sc.id })} style={(st) => [s.scheme, on && s.schemeOn, (st as { hovered?: boolean }).hovered && !on && { borderColor: v('border-strong') }]}>
              <View style={[s.swatch, { backgroundColor: t.bg }]}>
                <View style={{ flex: 1, backgroundColor: t.ground, borderRadius: 6 }} />
                <View style={{ width: 28, backgroundColor: sc.accent, borderRadius: 6 }} />
                <View style={{ position: 'absolute', left: 10, bottom: 8, width: 44, height: 5, borderRadius: 3, backgroundColor: t.text, opacity: 0.85 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.schemeName}>{sc.name}</Text>
                {on && <Icon name="check" size={14} color={v('accent-ink')} />}
              </View>
              <Txt variant="small">{sc.blurb}</Txt>
            </Pressable>
          );
        })}
      </View>

      <View style={s.rowWrap}>
        <View style={{ gap: 6, minWidth: 220, flex: 1 }}>
          <Txt variant="heading" {...{ htmlFor: 'mode', role: 'label' }}>
            Light or dark
          </Txt>
          <select id="mode" value={appearance.mode} onChange={(e) => update({ mode: e.target.value as 'dark' | 'light' | 'system' })} aria-label="Light or dark mode">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">Match system</option>
          </select>
        </View>
        <View style={{ gap: 6, minWidth: 220, flex: 1 }}>
          <Txt variant="heading" {...{ htmlFor: 'motion', role: 'label' }}>
            Motion
          </Txt>
          <select id="motion" value={appearance.motion} onChange={(e) => update({ motion: e.target.value as Motion })} aria-label="Motion">
            <option value="system">Match system</option>
            <option value="full">Full: leaves, light & orbiting stars</option>
            <option value="reduce">Reduced: still scenes</option>
          </select>
        </View>
      </View>
      <Pressable role="switch" aria-checked={appearance.leaves} onPress={() => update({ leaves: !appearance.leaves })} style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">Falling laurel leaves</Txt>
          <Txt variant="small">Drift through the scene on the home page.</Txt>
        </View>
        <SwitchMark on={appearance.leaves} />
      </Pressable>

      <Card style={{ gap: 18, marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Icon name="palette" size={18} color={v('accent-ink')} />
          <Txt variant="heading" style={{ flex: 1 }}>
            Pick Your Own Colours
          </Txt>
          <View role="radiogroup" aria-label="Colour to edit" style={s.segment}>
            {(['accent', 'ground'] as const).map((k) => (
              <Pressable key={k} role="radio" aria-checked={target === k} onPress={() => setTarget(k)} style={[s.segBtn, target === k && s.segOn]}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: seeds[k] }} />
                <Text style={[s.segText, target === k && { color: v('text') }]}>{k === 'accent' ? 'Accent' : 'Ground'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Txt variant="small">
          {target === 'accent' ? 'The accent is your sun: buttons, links, highlights & the crown.' : 'The ground tints the surfaces, like the night sky behind the gold.'} Changing either switches to Your Colours.
        </Txt>
        <View style={s.wheelRow}>
          <ColorWheel value={seeds[target]} onChange={setCustom} label={target === 'accent' ? 'Accent colour' : 'Ground colour'} />
          <View style={{ flex: 1, gap: 14, minWidth: 220 }}>
            <Field label="Hex" id="hex" value={hexDraft} onChangeText={setHexDraft} onBlur={commitHex} onSubmitEditing={commitHex} error={hexError} autoCapitalize="none" autoCorrect={false} spellCheck={false} />
            <View style={{ gap: 8 }}>
              <Txt variant="small" style={{ color: v('text') }}>
                Suggestions
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map((sg) => (
                  <Pressable key={sg.hex} role="button" aria-label={`Use ${sg.name}, ${sg.hex}`} onPress={() => setCustom(sg.hex)} style={(st) => [s.sugg, (st as { hovered?: boolean }).hovered && { borderColor: v('border-strong') }]}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: sg.hex }} />
                    <Text style={s.suggText}>{sg.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {'EyeDropper' in window && <Button size="sm" icon="pipette" label="Pick From Screen" onPress={pickFromScreen} style={{ alignSelf: 'flex-start' }} />}
            <View style={s.contrast} role="status">
              <Txt variant="small" style={{ color: v('text') }}>
                Accent text contrast <Text style={{ fontFamily: font.mono }}>{ratio.toFixed(1)}:1</Text> · {ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Low'}
              </Txt>
              <Txt variant="small">
                {normalizeHex(seeds.accent) !== ensureContrast(seeds.accent, tokens['surface-2'], 4.6)
                  ? 'Links & labels use a lighter or darker shade of your accent so they stay readable.'
                  : 'Your accent is readable as-is.'}
              </Txt>
            </View>
          </View>
        </View>
      </Card>
    </Section>
  );
}

function SyncSettings() {
  const vault = useVault();
  const { sync } = useApp();
  const state = useSyncState();
  const [name, setName] = useState(vault.deviceNames().get(vault.replica) ?? '');
  const [server, setServer] = useState(state.server);

  return (
    <Section roman="II" title="Sync">
      <View style={s.rowWrap}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Field label="Device name" id="device-name" value={name} onChangeText={setName} onBlur={() => name.trim() && vault.setDeviceName(name.trim())} onSubmitEditing={() => name.trim() && vault.setDeviceName(name.trim())} hint="Shown in Palimpsest & Provenance on every device." autoComplete="off" />
        </View>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Field
            label="Relay address"
            id="relay"
            value={server}
            onChangeText={setServer}
            onBlur={() => sync.setServer(server)}
            onSubmitEditing={() => sync.setServer(server)}
            placeholder="Same origin (default)…"
            hint="Leave empty when the app is served by the relay or the dev proxy."
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            {...({ inputMode: 'url' } as object)}
          />
        </View>
      </View>
      <Pressable role="switch" aria-checked={state.expedition} onPress={() => sync.setExpedition(!state.expedition)} style={s.switchRow}>
        <Icon name="expedition" size={20} color={v('accent-ink')} />
        <View style={{ flex: 1 }}>
          <Txt variant="heading">Expedition mode</Txt>
          <Txt variant="small">Stop all network use, as if you’d walked out of signal. Edits wait in SQLite and merge when you turn it off.</Txt>
        </View>
        <SwitchMark on={state.expedition} />
      </Pressable>
      <Card style={{ gap: 8 }}>
        <Fact k="Status" v={state.status === 'idle' ? 'Online' : state.status === 'syncing' ? 'Syncing…' : state.status === 'expedition' ? 'Expedition mode' : state.error ?? 'Offline'} />
        <Fact k="Waiting to send" v={`${num(state.queued)} ops`} />
        <Fact k="Last sync" v={state.lastSync ? relative(state.lastSync) : 'Never'} />
        <Fact k="This device’s replica id" v={vault.replica} mono />
        <Fact k="Storage slot" v={deviceSlot} mono />
        <Button size="sm" icon="sync" label="Sync Now" disabled={state.expedition} loading={state.status === 'syncing'} onPress={() => sync.syncNow()} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
      </Card>
      <Txt variant="small">
        To try two devices on one computer, open this app again with <Text style={{ fontFamily: font.mono, color: v('text') }}>?device=tablet</Text> in the address. Each slot keeps its own SQLite database & replica id.
      </Txt>
    </Section>
  );
}

function DataSettings() {
  const vault = useVault();
  const { toast } = useApp();
  const [confirming, setConfirming] = useState(false);
  const notes = vault.list().filter((m) => !m.trashed);
  const ops = [...vault.notes.values()].reduce((n, x) => n + x.ops.size, 0);

  const download = (name: string, text: string, type: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportAll = () => download(`fieldnote-${new Date().toISOString().slice(0, 10)}.md`, notes.map((m) => `# ${m.title}\n\n${m.body.trim()}\n`).join('\n---\n\n'), 'text/markdown');
  const exportOps = () => download('fieldnote-ops.jsonl', [...vault.notes.values()].flatMap((n) => [...n.ops.values()].map((o) => JSON.stringify(o))).join('\n'), 'application/x-ndjson');

  const importFiles = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt,text/markdown,text/plain';
    input.multiple = true;
    input.onchange = async () => {
      const files = [...(input.files ?? [])];
      for (const f of files) vault.create(f.name.replace(/\.(md|markdown|txt)$/i, ''), await f.text());
      if (files.length) toast({ title: `Imported ${files.length} ${files.length === 1 ? 'note' : 'notes'}`, tone: 'success' });
    };
    input.click();
  };

  const erase = async () => {
    await LocalDB.wipe();
    location.reload();
  };

  return (
    <Section roman="III" title="Data">
      <Card style={{ gap: 8 }}>
        <Fact k="Notes" v={num(notes.length)} />
        <Fact k="Operations in SQLite" v={num(ops)} />
        <Fact k="Database size" v={`${num(Math.round(vault.db.sizeBytes() / 1024))} KB`} />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Button icon="download" label="Export Notes as Markdown" onPress={exportAll} />
        <Button icon="download" label="Export Op Log" onPress={exportOps} />
        <Button icon="upload" label="Import Markdown…" onPress={importFiles} />
      </View>
      <View style={s.danger}>
        <View style={{ flex: 1, minWidth: 220, gap: 2 }}>
          <Txt variant="heading">Erase this device</Txt>
          <Txt variant="small">Deletes the local database for the “{deviceSlot}” slot. Ops not yet synced ({num(useSyncState().queued)}) are lost.</Txt>
        </View>
        {confirming ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button kind="ghost" label="Cancel" onPress={() => setConfirming(false)} />
            <Button kind="danger" icon="trash" label="Erase Now" onPress={erase} />
          </View>
        ) : (
          <Button kind="danger" label="Erase Local Data…" onPress={() => setConfirming(true)} />
        )}
      </View>
    </Section>
  );
}

function Section({ roman, title, children }: { roman: string; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 14, marginBottom: 44 }}>
      <Label roman={roman}>{title}</Label>
      {children}
    </View>
  );
}

function Fact({ k, v: value, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <Txt variant="small">{k}</Txt>
      <Txt variant={mono ? 'mono' : 'body'} style={{ fontSize: 13 }} selectable>
        {value}
      </Txt>
    </View>
  );
}

const s = sx({
  page: { width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 40, paddingBottom: 96, gap: 4 },
  schemes: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  scheme: { flexGrow: 1, flexBasis: 200, gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: v('border'), backgroundColor: v('surface'), cursor: 'pointer', transitionProperty: 'border-color, box-shadow', transitionDuration: '150ms' },
  schemeOn: { borderColor: v('accent'), boxShadow: `0 0 0 1px ${v('accent')}` },
  swatch: { height: 72, borderRadius: 9, padding: 6, flexDirection: 'row', gap: 6, position: 'relative', borderWidth: 1, borderColor: v('border') },
  schemeName: { fontFamily: font.ui, fontSize: 14.5, fontWeight: '600', color: v('text') },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: v('border'), backgroundColor: v('surface'), cursor: 'pointer' },
  segment: { flexDirection: 'row', padding: 2, gap: 2, borderRadius: 8, backgroundColor: v('surface-2'), borderWidth: 1, borderColor: v('border') },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 28, borderRadius: 6, cursor: 'pointer' },
  segOn: { backgroundColor: v('surface') },
  segText: { fontFamily: font.ui, fontSize: 12.5, fontWeight: '500', color: v('text-muted') },
  wheelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' },
  sugg: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 30, borderRadius: 999, borderWidth: 1, borderColor: v('border'), cursor: 'pointer' },
  suggText: { fontFamily: font.ui, fontSize: 12.5, color: v('text') },
  contrast: { padding: 12, borderRadius: 10, backgroundColor: v('surface-2'), gap: 2 },
  danger: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: v('danger'), backgroundColor: v('danger-soft'), marginTop: 6 },
});
