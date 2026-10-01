import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccounts } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { FireflyForm } from '../settings/Connections';
import { AccountsEditor } from '../settings/Accounts';
import { TaxForm } from '../settings/Tax';
import { AuthLayout } from './AuthLayout';

const STEPS = ['connect', 'accounts', 'business', 'done'] as const;
type Step = (typeof STEPS)[number];

/** Guided first configuration after the password has been created. */
export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('connect');
  const idx = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]);

  return (
    <AuthLayout title={t('setup.welcomeTitle')} wide>
      <ol className="mb-6 flex items-center gap-2 text-xs font-medium">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full border',
                i < idx && 'border-primary bg-primary text-primary-foreground',
                i === idx && 'border-primary text-primary',
                i > idx && 'text-muted-foreground',
              )}
            >
              {i < idx ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('hidden sm:inline', i === idx ? 'text-foreground' : 'text-muted-foreground')}>{t(`setup.steps.${s}`)}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      {step === 'connect' && (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t('setup.connectBody')}</p>
          <FireflyForm compact onSaved={next} />
          <SkipRow onSkip={() => navigate('/')} />
        </div>
      )}
      {step === 'accounts' && <AccountsStep onNext={next} />}
      {step === 'business' && (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t('setup.businessBody')}</p>
          <TaxForm compact onSaved={next} />
          <SkipRow onSkip={next} />
        </div>
      )}
      {step === 'done' && (
        <div className="grid justify-items-center gap-3 py-6 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-positive/15 text-positive">
            <Check className="size-6" />
          </div>
          <h2 className="text-lg font-semibold">{t('setup.doneTitle')}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{t('setup.doneBody')}</p>
          <Button size="lg" className="mt-2" onClick={() => navigate('/')}>
            {t('setup.goToDashboard')}
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}

function SkipRow({ onSkip }: { onSkip: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end">
      <Button variant="ghost" onClick={onSkip}>
        {t('common.skip')}
      </Button>
    </div>
  );
}

function AccountsStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  // The first sync starts automatically after Firefly is saved; poll until it has found the accounts.
  const accounts = useAccounts({ waitForFirstSync: true });
  const has = (accounts.data?.accounts.length ?? 0) > 0;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('setup.accountsBody')}</p>
      {!has ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t('setup.accountsWaiting')}
        </p>
      ) : (
        <AccountsEditor inline onSaved={onNext} />
      )}
      <SkipRow onSkip={onNext} />
    </div>
  );
}
