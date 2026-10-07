import type { Metadata } from 'next';
import { EmailActionHandler } from './email-action-handler';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Complete your account action | AI Status',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function EmailActionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-16">
      <EmailActionHandler mode={first(params.mode)} oobCode={first(params.oobCode)} />
    </main>
  );
}
