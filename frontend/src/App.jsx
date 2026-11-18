import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import './App.css';
import SideNavbar from './components/SideNavbar/SideNavbar';
import Breadcrumbs from './components/Breadcrumbs/Breadcrumbs';
import ProjectFormModal from './components/ProjectModals/ProjectFormModal';
import GeofenceConfigModal from './components/ProjectModals/GeofenceConfigModal';
import AssignPartnerModal from './components/ProjectModals/AssignPartnerModal';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import ChatNotificationToaster from './components/ChatNotificationToaster/ChatNotificationToaster';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import { setView, syncViewFromPopState } from './store/slices/routingSlice';

// Code-split pages for high performance and reduced initial bundle weight
const SignInPage = lazy(() => import('./pages/SignInPage/SignInPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage/SignUpPage'));
const SubscribePage = lazy(() => import('./pages/SubscribePage/SubscribePage'));
const SuperadminLoginPage = lazy(() => import('./pages/SuperadminLoginPage/SuperadminLoginPage'));
const SuperadminDashboard = lazy(() => import('./pages/SuperadminDashboard/SuperadminDashboard'));
const NoProjectPage = lazy(() => import('./pages/NoProjectPage/NoProjectPage'));
const PublicTransmittalPage = lazy(() => import('./pages/PublicTransmittalPage/PublicTransmittalPage'));

const OverviewPage = lazy(() => import('./pages/OverviewPage/OverviewPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage/ProjectsPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage/InventoryPage'));
const NewBatchPage = lazy(() => import('./pages/NewBatchPage/NewBatchPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage/ResultsPage'));
const BatchHistoryPage = lazy(() => import('./pages/BatchHistoryPage/BatchHistoryPage'));
const BBSPage = lazy(() => import('./pages/BBSPage/BBSPage'));
const CastingPage = lazy(() => import('./pages/CastingPage/CastingPage'));
const GeneralInventoryPage = lazy(() => import('./pages/GeneralInventoryPage/GeneralInventoryPage'));
const CrmPage = lazy(() => import('./pages/CrmPage/CrmPage'));
const DrawingsPage = lazy(() => import('./pages/DrawingsPage/DrawingsPage'));
const PettyCashPage = lazy(() => import('./pages/PettyCashPage/PettyCashPage'));
const ContractorsPage = lazy(() => import('./pages/ContractorsPage/ContractorsPage'));
const CompanyLabourPage = lazy(() => import('./pages/ManpowerPage/CompanyLabourPage'));
const ContractorLabourPage = lazy(() => import('./pages/ManpowerPage/ContractorLabourPage'));
const MarkAttendancePage = lazy(() => import('./pages/AttendancePage/MarkAttendancePage'));
const AttendanceHistoryPage = lazy(() => import('./pages/AttendancePage/AttendanceHistoryPage'));
const AttendanceReportsPage = lazy(() => import('./pages/AttendancePage/AttendanceReportsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage/ReportsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage/ChatPage'));
const LedgerPage = lazy(() => import('./pages/LedgerPage/LedgerPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage/SettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage/UsersPage'));
const RolesPage = lazy(() => import('./pages/RolesPage/RolesPage'));
const ActivityLogsPage = lazy(() => import('./pages/ActivityLogsPage/ActivityLogsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage/ProfilePage'));
const ProjectManagementPage = lazy(() => import('./pages/ProjectManagementPage/ProjectManagementPage'));
const BbsProjectsPage = lazy(() => import('./pages/BBSPage/BbsProjectsPage'));
const BbsDashboardPage = lazy(() => import('./pages/BBSPage/BbsDashboardPage'));
const BbsWizardPage = lazy(() => import('./pages/BBSPage/BbsWizardPage'));
const BbsReportsPage = lazy(() => import('./pages/BBSPage/BbsReportsPage'));
const BbsShapesPage = lazy(() => import('./pages/BBSPage/BbsShapesPage'));
import { loginSuccess, logout, updateActivity } from './store/slices/authSlice';
import { permissionsApi, projectsApi, setActiveProjectHeader } from './utils/api';
import { autoRegisterPushDevice } from './utils/pushNotifications';
import { setPermissions, clearPermissions } from './store/slices/permissionsSlice';
import {
  setProjects,
  setSelectedProject,
  fetchProjectsStart,
  fetchProjectsFailure,
  clearProjectContext,
  ACTIVE_PROJECT_KEY,
} from './store/slices/projectSlice';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** Views that do not require an active project */
const NO_PROJECT_SAFE_VIEWS = new Set([
  'signin',
  'signup',
  'subscribe',
  'superadmin-login',
  'superadmin',
  'no-project',
  'profile',
  'chat',
  'manpower-labour',
  'public-transmittal',
]);

function App() {
  const dispatch = useDispatch();
  const view = useSelector((state) => state.routing.view);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isDeveloper = useSelector((state) => state.auth.isDeveloper);
  const projectsReady = useSelector((state) => state.project.projectsReady);
  const selectedProject = useSelector((state) => state.project.selectedProject);
  const projects = useSelector((state) => state.project.projects);
  const isCreateModalOpen = useSelector((state) => state.project?.isCreateModalOpen);
  const geofenceModalProject = useSelector((state) => state.project?.geofenceModalProject);
  const assignPartnerModalProject = useSelector((state) => state.project?.assignPartnerModalProject);
  const projectEpoch = useSelector((state) => state.project.projectEpoch);

  const [optimizationData, setOptimizationData] = useState(null);
  const [editBatchParams, setEditBatchParams] = useState(null);
  const [projectBootstrapping, setProjectBootstrapping] = useState(false);
  const validateGen = useRef(0);

  // Keep API X-Project-Id in sync with validated selection
  useEffect(() => {
    const id = selectedProject?._id || selectedProject?.id || null;
    setActiveProjectHeader(id);
  }, [selectedProject, projectEpoch]);

  // Automatically register browser device for Web Push & FCM upon login
  useEffect(() => {
    if (isAuthenticated && !isDeveloper && view !== 'superadmin' && view !== 'superadmin-login') {
      autoRegisterPushDevice(false);
    }
  }, [isAuthenticated, isDeveloper, view]);

  // Authenticate → load permissions + projects → validate active project via backend
  useEffect(() => {
    if (!isAuthenticated || isDeveloper || view === 'superadmin' || view === 'superadmin-login') return;
    const token = sessionStorage.getItem('accessToken');
    if (!token) return;

    let cancelled = false;
    const gen = ++validateGen.current;

    const bootstrap = async () => {
      setProjectBootstrapping(true);
      try {
        const perms = await permissionsApi.getEffective().catch(() => null);
        if (cancelled || gen !== validateGen.current) return;
        if (perms) {
          dispatch(setPermissions(perms));
          if (perms.companyStatus === 'suspended' || perms.subscription?.isExpired) {
            dispatch(setView('subscribe'));
            setProjectBootstrapping(false);
            return;
          }
        }

        dispatch(fetchProjectsStart());
        const listRaw = await projectsApi.getAll();
        if (cancelled || gen !== validateGen.current) return;
        const list = Array.isArray(listRaw) ? listRaw : Array.isArray(listRaw?.data) ? listRaw.data : [];
        dispatch(setProjects(list));

        if (list.length === 0) {
          dispatch(setSelectedProject(null));
          dispatch(setView('no-project'));
          setProjectBootstrapping(false);
          return;
        }

        const hint =
          localStorage.getItem(ACTIVE_PROJECT_KEY) ||
          null;

        let chosen = null;
        if (hint) {
          const inList = list.find((p) => String(p._id || p.id) === String(hint));
          if (inList) {
            try {
              // Backend is source of truth for authorization — never trust storage alone
              chosen = await projectsApi.getById(hint);
            } catch {
              chosen = null;
            }
          }
        }

        if (!chosen) {
          chosen = list.find((p) => p.status === 'active') || list[0];
          try {
            chosen = await projectsApi.getById(chosen._id || chosen.id);
          } catch {
            chosen = list.find((p) => p.status === 'active') || list[0];
          }
        }

        if (cancelled || gen !== validateGen.current) return;
        dispatch(setSelectedProject(chosen));
        setProjectBootstrapping(false);
      } catch (err) {
        console.warn('Project bootstrap failed:', err);
        if (!cancelled) {
          dispatch(fetchProjectsFailure(err.message || 'Failed to load projects'));
          setProjectBootstrapping(false);
        }
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isDeveloper, view, dispatch]);

  // Ensure active developer session consistently renders developer console
  useEffect(() => {
    if (isDeveloper && view !== 'superadmin' && view !== 'superadmin-login') {
      dispatch(setView('superadmin'));
    }
  }, [isDeveloper, view, dispatch]);

  // Leave auth screens / no-project once bootstrap has a valid project
  useEffect(() => {
    if (!isAuthenticated || isDeveloper || view === 'superadmin' || view === 'superadmin-login' || !projectsReady || projectBootstrapping) return;

    if (view === 'signin' || view === 'signup') {
      if (projects.length > 0 && selectedProject) {
        dispatch(setView('overview'));
      } else if (projects.length === 0) {
        dispatch(setView('no-project'));
      }
      return;
    }

    if (projects.length > 0 && selectedProject && view === 'no-project') {
      dispatch(setView('overview'));
    }
    if (projects.length === 0 && view !== 'no-project' && view !== 'subscribe' && !NO_PROJECT_SAFE_VIEWS.has(view)) {
      dispatch(setView('no-project'));
    }
  }, [isAuthenticated, isDeveloper, projectsReady, projectBootstrapping, projects.length, selectedProject, view, dispatch]);

  // Guard: project-scoped views require validated project
  useEffect(() => {
    if (!isAuthenticated || isDeveloper || view === 'superadmin' || view === 'superadmin-login' || !projectsReady || projectBootstrapping) return;
    if (NO_PROJECT_SAFE_VIEWS.has(view)) return;
    if (!selectedProject) {
      dispatch(setView('no-project'));
    }
  }, [isAuthenticated, isDeveloper, projectsReady, projectBootstrapping, selectedProject, view, dispatch]);

  useEffect(() => {
    const storedThemeMode = localStorage.getItem('themeMode') || 'dark';
    const storedThemeColor = localStorage.getItem('themeColor') || 'slate-emerald';
    document.documentElement.setAttribute('data-theme', storedThemeMode);
    document.documentElement.setAttribute('data-color-theme', storedThemeColor);

    const handlePopState = (event) => {
      const tokenExists = sessionStorage.getItem('accessToken');
      if (window.location.pathname.startsWith('/t/')) {
        dispatch(syncViewFromPopState('public-transmittal'));
        return;
      }
      if (event.state && event.state.view) {
        if (!tokenExists && event.state.view !== 'signin' && event.state.view !== 'signup' && event.state.view !== 'superadmin-login' && event.state.view !== 'public-transmittal') {
          dispatch(setView('signin'));
        } else {
          dispatch(syncViewFromPopState(event.state.view));
        }
      } else {
        const rawPath = (window.location.pathname || '/').length > 1
          ? window.location.pathname.replace(/\/+$/, '')
          : (window.location.pathname || '/');
        if (rawPath === '/developer' || rawPath === '/superadmin') {
          dispatch(syncViewFromPopState('superadmin'));
        } else if (rawPath === '/developer-login' || rawPath === '/superadmin-login') {
          dispatch(syncViewFromPopState('superadmin-login'));
        } else {
          dispatch(syncViewFromPopState(tokenExists ? 'overview' : 'signin'));
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let throttleTimeout = null;

    const handleUserActivity = () => {
      if (!throttleTimeout) {
        dispatch(updateActivity());
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 10000);
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    const intervalId = setInterval(() => {
      const lastActivity = sessionStorage.getItem('lastActivity');
      if (lastActivity) {
        const timeDiff = Date.now() - parseInt(lastActivity, 10);
        if (timeDiff >= SESSION_TIMEOUT_MS) {
          dispatch(clearProjectContext());
          dispatch(clearPermissions());
          setActiveProjectHeader(null);
          dispatch(logout());
          dispatch(setView('signin'));
        }
      } else {
        dispatch(clearProjectContext());
        dispatch(clearPermissions());
        setActiveProjectHeader(null);
        dispatch(logout());
        dispatch(setView('signin'));
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      clearInterval(intervalId);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [isAuthenticated, dispatch]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const handleSignInSuccess = (authData) => {
    dispatch(loginSuccess(authData));
    const u = authData?.user;
    if (u?.accountType === 'developer' || u?.role === 'DEVELOPER' || u?.role === 'SUPER_ADMIN') {
      dispatch(clearProjectContext());
      dispatch(clearPermissions());
      setActiveProjectHeader(null);
      dispatch(setView('superadmin'));
      return;
    }
    const perms = authData?.permissions;
    if (perms && (perms.companyStatus === 'suspended' || perms.subscription?.isExpired)) {
      dispatch(setView('subscribe'));
      return;
    }
    // Keep view on signin/signup briefly; render skips auth pages once authenticated
    // and the bootstrap effect navigates to overview / no-project when ready.
  };

  const handleLogout = () => {
    dispatch(clearProjectContext());
    dispatch(clearPermissions());
    setActiveProjectHeader(null);
    dispatch(logout());
    dispatch(setView('signin'));
  };

  const handleNavigate = (newView) => {
    if (!selectedProject && !NO_PROJECT_SAFE_VIEWS.has(newView) && newView !== 'no-project') {
      dispatch(setView('no-project'));
      return;
    }
    dispatch(setView(newView));
  };

  const showNoProject =
    isAuthenticated &&
    projectsReady &&
    !projectBootstrapping &&
    (!selectedProject || projects.length === 0 || view === 'no-project');

  const showWorkspace =
    isAuthenticated &&
    projectsReady &&
    !projectBootstrapping &&
    selectedProject &&
    projects.length > 0 &&
    view !== 'no-project' &&
    view !== 'signin' &&
    view !== 'signup' &&
    view !== 'subscribe' &&
    view !== 'superadmin-login' &&
    view !== 'superadmin' &&
    view !== 'public-transmittal';

  return (
    <div className="app-layout">
      <Suspense fallback={<LoadingSpinner message="Loading module..." />}>
        {view === 'public-transmittal' ? (
          <PublicTransmittalPage />
        ) : view === 'signin' ? (
          <SignInPage
            onSignIn={handleSignInSuccess}
            onNavigateToSignUp={() => {
              dispatch(setView('signup'));
            }}
            onNavigateToDeveloper={() => {
              dispatch(setView('superadmin-login'));
            }}
          />
        ) : !isAuthenticated && view === 'signup' ? (
          <SignUpPage
            onSignUp={handleSignInSuccess}
            onNavigateToSignIn={() => {
              dispatch(setView('signin'));
            }}
          />
        ) : view === 'subscribe' ? (
          <SubscribePage />
        ) : view === 'superadmin-login' ? (
          <SuperadminLoginPage />
        ) : view === 'superadmin' || isDeveloper ? (
          <SuperadminDashboard />
        ) : isAuthenticated && (!projectsReady || projectBootstrapping) ? (
          <div className="no-project-page">
            <div className="no-project-card">
              <p>Loading your projects…</p>
            </div>
          </div>
        ) : showNoProject ? (
          <>
            <NoProjectPage onLogout={handleLogout} />
            {isCreateModalOpen && <ProjectFormModal />}
          </>
        ) : showWorkspace ? (
          <div className="app-workspace">
            <SideNavbar currentView={view} onViewChange={handleNavigate} onLogout={handleLogout} />
            <div className="main-viewport">
              <Breadcrumbs />
              {view === 'overview' && <OverviewPage onNavigate={handleNavigate} />}
              {view === 'projects' && <ProjectsPage />}
              {view === 'inventory' && <InventoryPage />}
              {view === 'inputs' && (
                <NewBatchPage
                  editParams={editBatchParams}
                  clearEditParams={() => setEditBatchParams(null)}
                  onOptimize={(data) => {
                    setOptimizationData(data);
                    dispatch(setView('results'));
                  }}
                />
              )}
              {view === 'results' && (
                <ResultsPage
                  data={optimizationData}
                  onBack={() => {
                    dispatch(setView('inputs'));
                  }}
                  onSaveSuccess={() => {
                    dispatch(setView('history'));
                  }}
                />
              )}
              {view === 'history' && (
                <BatchHistoryPage
                  onEditBatch={(batch) => {
                    setEditBatchParams(batch);
                    dispatch(setView('inputs'));
                  }}
                />
              )}
              {view === 'bbs' && (
                <BBSPage />
              )}
              {view === 'casting' && (
                <CastingPage />
              )}
              {view === 'general-inventory' && (
                <GeneralInventoryPage />
              )}
              {view === 'crm' && (
                <CrmPage />
              )}
              {view === 'project-management' && (
                <ProjectManagementPage />
              )}
              {(view === 'drawings' || (typeof view === 'string' && view.startsWith('drawings-'))) && (
                <DrawingsPage subView={view} />
              )}
              {view === 'petty-cash' && (
                <PettyCashPage />
              )}
              {view === 'contractors' && (
                <ContractorsPage />
              )}
              {view === 'manpower-labour' && (
                <CompanyLabourPage />
              )}
              {view === 'manpower-contractor-labour' && (
                <ContractorLabourPage />
              )}
              {view === 'attendance-mark' && (
                <MarkAttendancePage />
              )}
              {view === 'attendance-history' && (
                <AttendanceHistoryPage />
              )}
              {view === 'attendance-reports' && (
                <AttendanceReportsPage />
              )}
              {view === 'reports' && (
                <ReportsPage />
              )}
              {view === 'chat' && (
                <ChatPage />
              )}
              {view === 'ledger' && (
                <LedgerPage />
              )}
              {view === 'activity-logs' && (
                <ActivityLogsPage />
              )}
              {view === 'settings' && (
                <SettingsPage />
              )}
              {view === 'users' && (
                <UsersPage />
              )}
              {view === 'roles' && (
                <RolesPage />
              )}
              {view === 'profile' && (
                <ProfilePage onNavigate={handleNavigate} />
              )}
              {view === 'bbs-projects' && (
                <BbsProjectsPage />
              )}
              {view === 'bbs-dashboard' && (
                <BbsDashboardPage />
              )}
              {view === 'bbs-wizard' && (
                <BbsWizardPage />
              )}
              {view === 'bbs-shapes' && (
                <BbsShapesPage />
              )}
              {view === 'bbs-reports' && (
                <BbsReportsPage />
              )}
            </div>
          </div>
        ) : (
          <SignInPage
            onSignIn={handleSignInSuccess}
            onNavigateToSignUp={() => dispatch(setView('signup'))}
            onNavigateToDeveloper={() => dispatch(setView('superadmin-login'))}
          />
        )}
      </Suspense>

      {showWorkspace && isCreateModalOpen && <ProjectFormModal />}
      {showWorkspace && geofenceModalProject && <GeofenceConfigModal />}
      {showWorkspace && assignPartnerModalProject && <AssignPartnerModal />}

      <ChatNotificationToaster />
      <ScrollToTop />
    </div>
  );
}

export default App;
