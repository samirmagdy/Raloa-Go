import Link from 'next/link';

export default function NotFound() {
  return <main className="raloa-main"><section className="raloa-prose"><p className="raloa-status">404</p><h1>That page moved.</h1><p>Return to Raloa and find the next useful place to go.</p><div className="raloa-actions"><Link className="raloa-button" href="/">Return home</Link></div></section></main>;
}
