import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Toast } from '../hooks/app';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Button, font, sx, v } from './kit';
import { slideIn } from './motion';

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <View style={s.stack} role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} dismiss={() => dismiss(t.id)} />
      ))}
    </View>
  );
}

function ToastCard({ toast, dismiss }: { toast: Toast; dismiss: () => void }) {
  const ref = useRef<View>(null);
  const { reduceMotion } = useTheme();
  const [hover, setHover] = useState(false);
  useLayoutEffect(() => {
    if (!reduceMotion) slideIn(ref.current as unknown as HTMLElement);
  }, []);
  useEffect(() => {
    if (hover) return;
    const t = setTimeout(dismiss, toast.action ? 9000 : 6000);
    return () => clearTimeout(t);
  }, [hover]);
  const tone = toast.tone ?? 'info';
  return (
    <Pressable ref={ref} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} {...{ tabIndex: -1 }} style={[s.card, tone === 'success' && s.success, tone === 'danger' && s.danger]} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={tone === 'success' ? 'check' : tone === 'danger' ? 'info' : 'leaf'} size={16} color={tone === 'success' ? v('success') : tone === 'danger' ? v('danger') : v('accent-ink')} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.title}>{toast.title}</Text>
        {toast.detail && <Text style={s.detail}>{toast.detail}</Text>}
      </View>
      {toast.action && (
        <Button
          size="sm"
          label={toast.action.label}
          onPress={() => {
            toast.action!.run();
            dismiss();
          }}
        />
      )}
      <Button size="sm" kind="ghost" hideLabel icon="close" label="Dismiss" onPress={dismiss} />
    </Pressable>
  );
}

const s = sx({
  stack: { position: 'fixed', right: 16, bottom: 40, zIndex: 200, gap: 8, width: 'min(400px, calc(100vw - 32px))', pointerEvents: 'box-none' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: v('border-strong'), backgroundColor: v('surface'), boxShadow: `0 16px 40px -12px ${v('shadow')}, 0 2px 6px ${v('shadow')}`, cursor: 'default' },
  success: { borderColor: v('success'), backgroundColor: v('surface') },
  danger: { borderColor: v('danger') },
  title: { fontFamily: font.ui, fontSize: 13.5, fontWeight: '600', color: v('text') },
  detail: { fontFamily: font.ui, fontSize: 12.5, lineHeight: 18, color: v('text-muted') },
});
