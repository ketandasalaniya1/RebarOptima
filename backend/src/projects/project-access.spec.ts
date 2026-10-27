import {
  normalizeRole,
  isPartnerAdminRole,
  isCompanyAdminRole,
  userHasProjectAssignment,
  ProjectAccessContext,
} from './project-access';

describe('project-access role normalization', () => {
  it('normalizes Project Partner Admin display name', () => {
    expect(normalizeRole('Project Partner Admin')).toBe('PROJECT_PARTNER_ADMIN');
    expect(isPartnerAdminRole('Project Partner Admin')).toBe(true);
    expect(isPartnerAdminRole('PROJECT_PARTNER_ADMIN')).toBe(true);
  });

  it('recognizes company admins', () => {
    expect(isCompanyAdminRole('Admin')).toBe(true);
    expect(isCompanyAdminRole('OWNER')).toBe(true);
    expect(isCompanyAdminRole('Viewer', 'developer')).toBe(true);
    expect(isCompanyAdminRole('Project Partner Admin')).toBe(false);
  });

  it('enforces assignment only when requiresProjectAssignment', () => {
    const scoped: ProjectAccessContext = {
      userId: 'u1',
      companyId: 'c1',
      role: 'Project Partner Admin',
      roleNormalized: 'PROJECT_PARTNER_ADMIN',
      userDoc: null,
      assignedProjects: ['p1'],
      dataScope: 'project',
      isCompanyAdmin: false,
      isPartnerAdmin: true,
      isDeveloper: false,
      requiresProjectAssignment: true,
    };
    expect(userHasProjectAssignment(scoped, 'p1')).toBe(true);
    expect(userHasProjectAssignment(scoped, 'p2')).toBe(false);

    const admin: ProjectAccessContext = {
      ...scoped,
      isCompanyAdmin: true,
      requiresProjectAssignment: false,
      assignedProjects: [],
    };
    expect(userHasProjectAssignment(admin, 'p2')).toBe(true);
  });
});
