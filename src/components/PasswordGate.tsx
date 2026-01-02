import { useEffect, useMemo, useState } from 'react';
import { sha256Base64 } from '@/lib/password';

type PasswordGateProps = {
  children: React.ReactNode;
};

const SESSION_KEY = 'dadbd_authed_v1';

export function PasswordGate({ children }: PasswordGateProps) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const config = useMemo(() => {
    const plain = import.meta.env.VITE_SITE_PASSWORD as string | undefined;
    const hash = import.meta.env.VITE_SITE_PASSWORD_HASH as string | undefined;
    return {
      plain: plain?.trim() || '',
      hash: hash?.trim() || '',
    };
  }, []);

  useEffect(() => {
    const isAuthed = sessionStorage.getItem(SESSION_KEY) === '1';
    setAuthed(isAuthed);
    setReady(true);
  }, []);

  const canCheck = config.hash || config.plain;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const input = password;
      const ok =
        (config.plain && input === config.plain) ||
        (config.hash && (await sha256Base64(input)) === config.hash);

      if (!ok) {
        setError('Неверный пароль');
        return;
      }
      sessionStorage.setItem(SESSION_KEY, '1');
      setAuthed(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;
  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6">
        <div className="text-xl font-display font-bold mb-2">Введите пароль</div>
        <div className="text-sm text-muted-foreground mb-4">
          Эта страница защищена паролем.
        </div>

        {!canCheck && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
            Пароль не настроен. Задайте <span className="font-medium">VITE_SITE_PASSWORD</span> или{' '}
            <span className="font-medium">VITE_SITE_PASSWORD_HASH</span> и перезапустите приложение.
            <div className="mt-2 text-xs text-destructive/80">
              Диагностика: VITE_SITE_PASSWORD={config.plain ? 'есть' : 'нет'}, VITE_SITE_PASSWORD_HASH={config.hash ? 'есть' : 'нет'}
            </div>
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && password) submit();
          }}
          placeholder="Пароль…"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        {error && <div className="text-sm text-destructive mt-2">{error}</div>}

        <button
          onClick={submit}
          disabled={!canCheck || !password || submitting}
          className="mt-4 w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? 'Проверяем…' : 'Войти'}
        </button>

        <div className="mt-3 text-xs text-muted-foreground">
          Подсказка: город встречи мамы и папы, год свадьбы, номер первой школы Арии (все на английском и слитно)
        </div>
      </div>
    </div>
  );
}


