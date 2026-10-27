import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Building2, LogOut, FolderPlus } from 'lucide-react';
import { openCreateModal } from '../../store/slices/projectSlice';
import { EmptyState, Button } from '../../components/ui';
import './NoProjectPage.css';

function canCreateProjects(user, permissions) {
  const role = (user?.role || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (user?.accountType === 'developer') return true;
  if (role === 'ADMIN' || role === 'OWNER' || role === 'COMPANY_ADMIN') return true;
  if (role === 'PROJECT_PARTNER_ADMIN' || role === 'PROJECTPARTNERADMIN') return false;
  const features = permissions?.features || {};
  if (features['projects.create'] === true) return true;
  if (permissions?.modules?.projects === false) return false;
  return false;
}

export default function NoProjectPage({ onLogout }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const permissions = useSelector((state) => state.permissions);
  const allowed = canCreateProjects(user, permissions);

  return (
    <div className="no-project-page">
      <div className="no-project-card">
        <EmptyState
          icon={<Building2 size={24} />}
          title={
            allowed
              ? "You haven't created any projects yet"
              : 'No project has been assigned to your account'
          }
          description={
            allowed
              ? 'A project is required to access Steel, Casting, Site Inventory, CRM, Drawings, and related dashboards.'
              : 'Ask your Company Admin to assign you to a project before you can use project-specific modules.'
          }
          action={
            <>
              {allowed ? (
                <Button variant="primary" onClick={() => dispatch(openCreateModal())}>
                  <FolderPlus size={16} />
                  Create Your First Project
                </Button>
              ) : null}
              {onLogout ? (
                <Button variant="ghost" onClick={onLogout}>
                  <LogOut size={16} />
                  Log out
                </Button>
              ) : null}
            </>
          }
        />
      </div>
    </div>
  );
}
