import { PublicCreatorProfile } from './components/PublicCreatorProfile';
import { getInitialLocale } from './utils/locale';

function publicHandle(): string {
  const match = window.location.pathname.match(/^\/(?:@|public-render\/)([a-zA-Z0-9._-]+)$/);
  return match?.[1] || '';
}

export default function PublicPageApp() {
  const handle = publicHandle();
  return (
    <PublicCreatorProfile
      handle={handle}
      locale={getInitialLocale()}
      onReturnHome={() => window.location.assign('/')}
      onNotFound={() => undefined}
    />
  );
}
