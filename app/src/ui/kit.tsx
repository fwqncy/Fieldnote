// React Native primitives styled with theme tokens. On the web these render
// through react-native-web; colours are CSS variables so a scheme change
// repaints without re-rendering the tree.

import { forwardRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';

/** StyleSheet.create that also accepts web-only keys (cursor, boxShadow…). */
export const sx = <T extends Record<string, Record<string, unknown>>>(s: T) => StyleSheet.create(s as never) as unknown as { [K in keyof T]: any };

export const v = (name: string) => `var(--${name})`;

export const font = {
  display: '"Big Shoulders Display", "Arial Narrow", sans-serif',
  serif: '"Cormorant Garamond", "Iowan Old Style", Georgia, serif',
  ui: '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

type PressState = { pressed: boolean; hovered?: boolean; focused?: boolean };

// ── text ────────────────────────────────────────────────────────────────────
type TxtProps = {
  children?: ReactNode;
  variant?: keyof typeof text;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  tone?: 'muted' | 'faint' | 'accent' | 'ground' | 'danger' | 'success';
  href?: string;
  nativeID?: string;
  selectable?: boolean;
  [key: string]: unknown;
};

export function Txt({ children, variant = 'body', style, tone, ...rest }: TxtProps) {
  const color = tone && { color: v(tone === 'accent' ? 'accent-ink' : tone === 'ground' ? 'ground-ink' : `text-${tone}`.replace('text-danger', 'danger').replace('text-success', 'success')) };
  return (
    <Text {...(rest as object)} style={[text[variant], color, style]}>
      {children}
    </Text>
  );
}

export const text = sx({
  poster: { fontFamily: font.display, fontWeight: '800', fontSize: 64, lineHeight: 58, letterSpacing: 2, textTransform: 'uppercase', color: v('text') },
  display: { fontFamily: font.serif, fontWeight: '600', fontSize: 40, lineHeight: 44, letterSpacing: -0.4, color: v('text') },
  title: { fontFamily: font.serif, fontWeight: '600', fontSize: 26, lineHeight: 30, color: v('text') },
  heading: { fontFamily: font.ui, fontWeight: '600', fontSize: 15, lineHeight: 20, color: v('text') },
  body: { fontFamily: font.ui, fontSize: 14, lineHeight: 21, color: v('text') },
  small: { fontFamily: font.ui, fontSize: 12.5, lineHeight: 18, color: v('text-muted') },
  label: { fontFamily: font.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.6, textTransform: 'uppercase', color: v('text-muted') },
  mono: { fontFamily: font.mono, fontSize: 12.5, lineHeight: 19, color: v('text'), fontVariantNumeric: 'tabular-nums' },
  italic: { fontFamily: font.serif, fontStyle: 'italic', fontSize: 19, lineHeight: 26, color: v('text-muted') },
});

// ── buttons ─────────────────────────────────────────────────────────────────
type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  icon?: IconName;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
  loading?: boolean;
  hideLabel?: boolean;
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  { label, icon, kind = 'secondary', size = 'md', style, trailing, loading, hideLabel, disabled, ...rest },
  ref,
) {
  const k = buttonKinds[kind];
  return (
    <Pressable
      ref={ref}
      role="button"
      aria-label={hideLabel ? label : undefined}
      aria-busy={loading || undefined}
      disabled={disabled}
      {...rest}
      style={(s) => {
        const { hovered, pressed } = s as PressState;
        return [
          btn.base,
          size === 'sm' ? btn.sm : btn.md,
          hideLabel && (size === 'sm' ? btn.iconSm : btn.iconMd),
          k.base,
          hovered && k.hover,
          pressed && btn.pressed,
          disabled && btn.disabled,
          style,
        ];
      }}
    >
      {loading ? <Icon name="loader" size={size === 'sm' ? 14 : 16} color={k.color} spin /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} color={k.color} />}
      {!hideLabel && (
        <Text style={[btn.text, size === 'sm' && btn.textSm, { color: k.color }]} numberOfLines={1}>
          {label}
        </Text>
      )}
      {trailing}
    </Pressable>
  );
});

const btn = sx({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', cursor: 'pointer', transitionProperty: 'background-color, border-color, transform', transitionDuration: '140ms', userSelect: 'none' },
  md: { minHeight: 36, paddingHorizontal: 14 },
  sm: { minHeight: 28, paddingHorizontal: 10, borderRadius: 6, gap: 6 },
  iconMd: { width: 36, paddingHorizontal: 0 },
  iconSm: { width: 28, paddingHorizontal: 0 },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5, cursor: 'not-allowed' },
  text: { fontFamily: font.ui, fontSize: 14, fontWeight: '500' },
  textSm: { fontSize: 12.5 },
});

const buttonKinds: Record<string, { base: object; hover: object; color: string }> = {
  primary: { ...sx({ base: { backgroundColor: v('accent'), boxShadow: `0 1px 0 rgba(255,255,255,.18) inset, 0 1px 2px ${v('shadow')}` }, hover: { filter: 'brightness(1.08)' } }), color: v('on-accent') },
  secondary: { ...sx({ base: { backgroundColor: v('surface-2'), borderColor: v('border') }, hover: { backgroundColor: v('surface-3'), borderColor: v('border-strong') } }), color: v('text') },
  ghost: { ...sx({ base: {}, hover: { backgroundColor: v('surface-2') } }), color: v('text-muted') },
  danger: { ...sx({ base: { backgroundColor: v('danger-soft'), borderColor: v('danger') }, hover: { filter: 'brightness(1.15)' } }), color: v('danger') },
};

/** Pressable row with hover & selected states, used by lists and menus. */
export function Row({ children, selected, onPress, href: link, style, label, ...rest }: { children: ReactNode; selected?: boolean; onPress?: () => void; href?: string; style?: StyleProp<ViewStyle>; label?: string; [k: string]: unknown }) {
  return (
    <Pressable
      role={link ? 'link' : 'button'}
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      {...({ href: link } as object)}
      onPress={onPress}
      {...(rest as object)}
      style={(s) => {
        const { hovered, pressed } = s as PressState;
        return [rowS.base, hovered && rowS.hover, selected && rowS.selected, pressed && rowS.pressed, style];
      }}
    >
      {children}
    </Pressable>
  );
}

const rowS = sx({
  base: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, cursor: 'pointer', textDecorationLine: 'none', transitionProperty: 'background-color', transitionDuration: '120ms' },
  hover: { backgroundColor: v('surface-2') },
  selected: { backgroundColor: v('accent-soft') },
  pressed: { opacity: 0.8 },
});

// ── inputs ──────────────────────────────────────────────────────────────────
export const Field = forwardRef<TextInput, TextInputProps & { label?: string; hint?: string; error?: string; icon?: IconName; id?: string }>(function Field(
  { label, hint, error, icon, style, id, ...rest },
  ref,
) {
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Txt variant="small" style={{ color: v('text'), fontWeight: '500' }} {...{ htmlFor: id, role: 'label' }}>
          {label}
        </Txt>
      )}
      <View style={field.wrap} {...({ dataSet: { field: '1' } } as object)}>
        {icon && <Icon name={icon} size={15} color={v('text-faint')} />}
        <TextInput ref={ref} nativeID={id} placeholderTextColor={v('text-faint') as string} aria-invalid={!!error || undefined} {...rest} style={[field.input, style]} />
      </View>
      {error ? (
        <Txt variant="small" tone="danger" role="alert">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small">{hint}</Txt>
      ) : null}
    </View>
  );
});

const field = sx({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: v('border'), backgroundColor: v('surface') },
  input: { flex: 1, minWidth: 0, fontFamily: font.ui, fontSize: 14, color: v('text'), paddingVertical: 8, outlineStyle: 'none' },
});

// ── bits ────────────────────────────────────────────────────────────────────
export function Label({ children, roman: r, style }: { children: ReactNode; roman?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Txt variant="label" style={style} role="heading" aria-level={2}>
      {r ? <Text style={{ color: v('accent-ink') }}>{r} · </Text> : null}
      {children}
    </Txt>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <Text style={kbd.k}>{children}</Text>;
}
const kbd = sx({
  k: { fontFamily: font.mono, fontSize: 11, color: v('text-muted'), paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: v('border'), backgroundColor: v('surface-2'), lineHeight: 16 },
});

export function Chip({ label, href: link, onPress, active }: { label: string; href?: string; onPress?: () => void; active?: boolean }) {
  return (
    <Pressable
      role={link ? 'link' : 'button'}
      {...({ href: link } as object)}
      onPress={onPress}
      style={(s) => [chip.base, ((s as PressState).hovered || active) && chip.hover]}
    >
      <Text style={chip.text}>{label}</Text>
    </Pressable>
  );
}
const chip = sx({
  base: { paddingHorizontal: 10, minHeight: 26, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: v('border-strong'), cursor: 'pointer', textDecorationLine: 'none' },
  hover: { borderColor: v('accent-line'), backgroundColor: v('accent-soft') },
  text: { fontFamily: font.mono, fontSize: 12, color: v('text'), letterSpacing: 0.4 },
});

export function Card({ children, style, ...rest }: { children: ReactNode; style?: StyleProp<ViewStyle>; [k: string]: unknown }) {
  return (
    <View {...(rest as object)} style={[card.base, style]}>
      {children}
    </View>
  );
}
const card = sx({
  base: {
    backgroundColor: v('surface'),
    borderWidth: 1,
    borderColor: v('border'),
    borderRadius: 14,
    padding: 16,
    boxShadow: `0 1px 0 rgba(255,255,255,.03) inset, 0 1px 2px ${v('shadow')}, 0 8px 24px -12px ${v('shadow')}`,
  },
});

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View role="separator" style={[{ height: 1, backgroundColor: v('border'), alignSelf: 'stretch' }, style]} />;
}

/** Visual switch; put role="switch" on the pressable row that contains it. */
export function SwitchMark({ on }: { on: boolean }) {
  return (
    <View aria-hidden style={[sw.track, on && sw.trackOn]}>
      <View style={[sw.thumb, on && sw.thumbOn]} />
    </View>
  );
}
const sw = sx({
  track: { width: 36, height: 22, borderRadius: 11, padding: 2, backgroundColor: v('surface-3'), borderWidth: 1, borderColor: v('border-strong'), transitionProperty: 'background-color, border-color', transitionDuration: '160ms' },
  trackOn: { backgroundColor: v('accent'), borderColor: v('accent') },
  thumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: v('text-muted'), transitionProperty: 'transform, background-color', transitionDuration: '160ms', transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)' },
  thumbOn: { transform: [{ translateX: 14 }], backgroundColor: v('on-accent') },
});
