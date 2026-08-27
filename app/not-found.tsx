import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-slate-900 dark:text-white mb-4">404</h1>
                <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
                    That page doesn&apos;t exist — but the status board does.
                </p>
                <Link
                    href="/"
                    className="inline-block bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-medium py-3 px-6 rounded-full transition-colors"
                >
                    Is my AI down? →
                </Link>
            </div>
        </div>
    );
}
