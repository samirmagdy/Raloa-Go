import Link from 'next/link';

export default function LoginPage() {
  return <><p className="raloa-status">Welcome back</p><h1>Sign in to Raloa.</h1><p>Authentication remains backed by the existing Firebase Auth flow during migration.</p><div className="raloa-actions"><Link className="raloa-button" href="/studio">Continue to Studio</Link><Link href="/auth/register">Create an account</Link></div></>;
}
