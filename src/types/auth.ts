export type UserRole = 'L3_ADMIN' | 'AI_TENANT' | 'TIER_1_TECH';

export interface UserPersona {
  id: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  badgeLabel: string;
  email: string;
  avatar: string;
  description: string;
  permissions: {
    canAccessSandbox: boolean;
    canExecuteMitigation: boolean;
    canViewFacilityMetrics: boolean;
    canViewGpuMetrics: boolean;
    canViewManuals: boolean;
  };
}

export const PERSONAS: Record<string, UserPersona> = {
  darshan: {
    id: 'darshan',
    name: 'Darshan Skolekar',
    role: 'L3_ADMIN',
    roleTitle: 'Lead Infrastructure SRE',
    badgeLabel: 'L3 Admin',
    email: 'darshanskolekar@beyondcorp.google.internal',
    avatar: '👨‍💻',
    description: 'Full cluster control, Chaos Sandbox access, and P1 mitigation execution permissions.',
    permissions: {
      canAccessSandbox: true,
      canExecuteMitigation: true,
      canViewFacilityMetrics: true,
      canViewGpuMetrics: true,
      canViewManuals: true,
    },
  },
  kritika: {
    id: 'kritika',
    name: 'Kritika Roy',
    role: 'AI_TENANT',
    roleTitle: 'ML Workload Engineer',
    badgeLabel: 'AI Tenant',
    email: 'kritikaroy@beyondcorp.google.internal',
    avatar: '👩‍💻',
    description: 'GPU compute and job queue monitoring only. Facility power/fluid controls locked.',
    permissions: {
      canAccessSandbox: false,
      canExecuteMitigation: false,
      canViewFacilityMetrics: false,
      canViewGpuMetrics: true,
      canViewManuals: true,
    },
  },
  tech: {
    id: 'tech',
    name: 'Marcus Vance',
    role: 'TIER_1_TECH',
    roleTitle: 'Field / Floor Technician',
    badgeLabel: 'Tier 1 Operator',
    email: 'marcus.vance@datacenter.ops.internal',
    avatar: '🛠️',
    description: 'Read-only telemetry, chassis inspection. High-risk mitigation execution locked.',
    permissions: {
      canAccessSandbox: false,
      canExecuteMitigation: false,
      canViewFacilityMetrics: true,
      canViewGpuMetrics: true,
      canViewManuals: true,
    },
  },
};
