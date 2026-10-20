import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <section className="card mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
      <p className="text-5xl font-bold text-uplift">404</p>
      <h2 className="text-lg font-bold">This page doesn’t exist</h2>
      <p className="text-sm text-muted">Check the address, or go back to the dashboard.</p>
      <Link to="/" className="btn-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Home
      </Link>
    </section>
  );
}
