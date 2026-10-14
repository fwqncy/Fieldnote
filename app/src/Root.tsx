import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { App } from './App';
import { Vault } from './store/vault';
import { SyncClient } from './sync/client';
import { ThemeProvider } from './theme/ThemeProvider';
import { Button, Txt, sx, v } from './ui/kit';
import { SunMark } from './ui/Ornaments';

type Boot = { vault: Vault; sync: SyncClient } | { error: string } | null;

export function Root() {
  const [boot, setBoot] = useState<Boot>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    document.body.classList.add('fn-grain');
    // Avoid flashing a loader for fast starts.
    const t = setTimeout(() => setSlow(true), 300);
    Vault.open()
      .then((vault) => setBoot({ vault, sync: new SyncClient(vault) }))
      .catch((e: unknown) => setBoot({ error: e instanceof Error ? e.message : String(e) }));
    return () => clearTimeout(t);
  }, []);

  return (
    <ThemeProvider>
      {boot && 'vault' in boot ? (
        <App vault={boot.vault} sync={boot.sync} />
      ) : (
        <View style={s.splash} role="status" aria-live="polite">
          {boot && 'error' in boot ? (
            <>
              <Txt variant="title">Fieldnote couldn’t open its database</Txt>
              <Txt variant="small" style={{ maxWidth: 420, textAlign: 'center' }}>
                {boot.error}. Private browsing can block on-device storage. Try a normal window, then reload.
              </Txt>
              <Button label="Reload" icon="sync" onPress={() => location.reload()} />
            </>
          ) : (
            slow && (
              <>
                <SunMark size={48} className="fn-spin" />
                <Txt variant="label">Opening the vault…</Txt>
              </>
            )
          )}
        </View>
      )}
    </ThemeProvider>
  );
}

const s = sx({
  splash: { flex: 1, height: '100dvh', alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: v('bg'), padding: 24 },
});
