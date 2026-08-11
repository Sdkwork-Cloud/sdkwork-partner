import type { ReactNode } from 'react';

/** Full-height page column wrapper matching the admin console layout. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-partner-admin>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
