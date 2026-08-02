export const STAFF_ROLES = ['ROLE_ORG_ADMIN', 'ROLE_HR', 'ROLE_RECRUITER', 'ROLE_SUPER_ADMIN', 'RECRUITER'];

export function hasStaffRole(memberships) {
  return memberships?.some(m => STAFF_ROLES.includes(m.role)) ?? false;
}

export function getEffectiveRole(memberships) {
  if (memberships?.some(m => m.role === 'ROLE_SUPER_ADMIN')) return 'ROLE_SUPER_ADMIN';
  if (memberships?.some(m => m.role === 'ROLE_ORG_ADMIN')) return 'ROLE_ORG_ADMIN';
  if (memberships?.some(m => m.role === 'ROLE_HR')) return 'ROLE_HR';
  if (memberships?.some(m => m.role === 'ROLE_RECRUITER' || m.role === 'RECRUITER')) return 'ROLE_RECRUITER';
  return 'ROLE_USER';
}
