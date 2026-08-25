'use client';

import { CrmDashboard } from '@/components/crm/Dashboard';
import { SiteShell } from '@/components/SiteShell';

export default function HomePage() {
  return (
    <SiteShell>
      <CrmDashboard />
    </SiteShell>
  );
}
