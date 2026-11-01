import React from 'react';
import { useSelector } from 'react-redux';

/**
 * RoleGate component for role- and permission-based UI guarding.
 * Checks user permissions, system role, and specific action grants.
 * If fallback is not provided, renders nothing when unauthorized.
 */
export default function RoleGate({ permission, role, children, fallback = null }) {
  const user = useSelector((state) => state.auth?.user);
  const permissions = useSelector((state) => state.permissions?.modules);
  const features = useSelector((state) => state.permissions?.features);

  const roleUpper = (user?.role || '').toUpperCase();
  const isSuperUser = roleUpper === 'ADMIN' || roleUpper === 'OWNER' || user?.accountType === 'developer';

  if (isSuperUser) {
    return <>{children}</>;
  }

  // Role check
  if (role) {
    const allowedRoles = Array.isArray(role) ? role.map((r) => r.toUpperCase()) : [role.toUpperCase()];
    if (!allowedRoles.includes(roleUpper)) {
      return fallback;
    }
  }

  // Permission check (e.g. 'drawing:upload', 'drawing:read', 'drawing:approve', etc.)
  if (permission) {
    // Check direct feature permission key
    if (features && features[permission] !== undefined) {
      if (features[permission] === false) return fallback;
      return <>{children}</>;
    }

    // If permissions/features are not explicitly configured, default to permissive for workflow actions
    if (!features || Object.keys(features).length === 0) {
      return <>{children}</>;
    }

    // Role-based heuristics for drawing:* permissions
    if (permission === 'drawing:upload') {
      const allowed = ['ADMIN', 'OWNER', 'PROJECT_PARTNER_ADMIN', 'CONTROLLER', 'UPLOADER', 'ENGINEER', 'USER', 'PROJECT_MANAGER', 'LEAD_ENGINEER'];
      if (!allowed.includes(roleUpper)) return fallback;
    } else if (permission === 'drawing:approve') {
      const allowed = ['ADMIN', 'OWNER', 'APPROVER', 'REVIEWER', 'LEAD_ENGINEER', 'PROJECT_MANAGER', 'USER', 'ENGINEER'];
      if (!allowed.includes(roleUpper)) return fallback;
    } else if (permission === 'drawing:void') {
      const allowed = ['ADMIN', 'OWNER', 'PROJECT_MANAGER'];
      if (!allowed.includes(roleUpper)) return fallback;
    } else if (permission === 'drawing:distribute') {
      const allowed = ['ADMIN', 'OWNER', 'CONTROLLER', 'PROJECT_MANAGER', 'USER', 'ENGINEER'];
      if (!allowed.includes(roleUpper)) return fallback;
    } else if (permission === 'drawing:audit_read') {
      const allowed = ['ADMIN', 'OWNER', 'AUDITOR', 'CONTROLLER', 'PROJECT_MANAGER', 'USER', 'ENGINEER'];
      if (!allowed.includes(roleUpper)) return fallback;
    }
  }

  return <>{children}</>;
}

