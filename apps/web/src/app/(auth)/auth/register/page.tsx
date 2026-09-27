import Link from 'next/link';

export default function RegisterPage() {
  return <><p className="raloa-status">Start with the essentials</p><h1>Create your Raloa page.</h1><p>The existing registration flow remains the source of truth until this route group is connected to the API application services.</p><div className="raloa-actions"><Link className="raloa-button" href="/studio">Continue to existing Studio</Link><Link href="/auth/login">I already have an account</Link></div></>;
}
