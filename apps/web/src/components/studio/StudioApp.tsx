'use client';

import { useRouter } from 'next/navigation';
import { AuthProvider } from '../../../../../src/contexts/AuthContext';
import { StudioModal } from '../../../../../src/components/modals/StudioModal';

/**
 * The Next Studio boundary mounts the existing editor implementation. Keeping
 * this as a single bridge prevents the Vite and Next applications from
 * developing separate editors while the Vite shell is retired.
 */
export function StudioApp() {
  const router = useRouter();
  return (
    <AuthProvider>
      <StudioModal
        locale="en"
        onClose={() => router.push('/')}
        onOpenAuth={(mode) => router.push(mode === 'signup' ? '/auth/register' : '/auth/login')}
        onOpenPricing={() => router.push('/account/settings?section=billing')}
        onManageBilling={() => router.push('/account/settings?section=billing')}
        onOpenAccountSettings={() => router.push('/account/settings')}
      />
    </AuthProvider>
  );
}
