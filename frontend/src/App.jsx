import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import './App.css';
import SideNavbar from './components/SideNavbar/SideNavbar';
import NewBatchPage from './pages/NewBatchPage/NewBatchPage';
import ResultsPage from './pages/ResultsPage/ResultsPage';
import SignInPage from './pages/SignInPage/SignInPage';
import SignUpPage from './pages/SignUpPage/SignUpPage';
import OverviewPage from './pages/OverviewPage/OverviewPage';
import InventoryPage from './pages/InventoryPage/InventoryPage';
import BatchHistoryPage from './pages/BatchHistoryPage/BatchHistoryPage';
import LedgerPage from './pages/LedgerPage/LedgerPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import UsersPage from './pages/UsersPage/UsersPage';
import RolesPage from './pages/RolesPage/RolesPage';
import ActivityLogsPage from './pages/ActivityLogsPage/ActivityLogsPage';
import ProfilePage from './pages/ProfilePage/ProfilePage';
import SuperadminLoginPage from './pages/SuperadminLoginPage/SuperadminLoginPage';
import SuperadminDashboard from './pages/SuperadminDashboard/SuperadminDashboard';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { setView, syncViewFromPopState } from './store/slices/routingSlice';
import { loginSuccess, logout, updateActivity } from './store/slices/authSlice';
import { permissionsApi } from './utils/api';
import { setPermissions } from './store/slices/permissionsSlice';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function App() {
  const dispatch = useDispatch();
  const view = useSelector((state) => state.routing.view);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const [optimizationData, setOptimizationData] = useState(null);
  const [editBatchParams, setEditBatchParams] = useState(null);

  // Synchronize effective permissions when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      permissionsApi.getEffective()
        .then((perms) => {
          if (perms) {
            dispatch(setPermissions(perms));
          }
        })
        .catch((err) => {
          console.warn('Could not refresh effective permissions:', err);
        });
    }
  }, [isAuthenticated, dispatch]);

  // Synchronize route session on mount and handle PopState events
  useEffect(() => {
    // Initial theme set from settings
    const storedThemeMode = localStorage.getItem('themeMode') || 'dark';
    const storedThemeColor = localStorage.getItem('themeColor') || 'slate-emerald';
    document.documentElement.setAttribute('data-theme', storedThemeMode);
    document.documentElement.setAttribute('data-color-theme', storedThemeColor);

    const handlePopState = (event) => {
      const tokenExists = sessionStorage.getItem('accessToken');
      if (event.state && event.state.view) {
        // Protected routes check
        if (!tokenExists && event.state.view !== 'signin' && event.state.view !== 'signup' && event.state.view !== 'superadmin-login') {
          dispatch(setView('signin'));
        } else {
          dispatch(syncViewFromPopState(event.state.view));
        }
      } else {
        dispatch(syncViewFromPopState(tokenExists ? 'overview' : 'signin'));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch]);

  // 30-minute Inactivity & Session Timeout Auto-Logout
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

    // Activity event listeners
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    // Periodic check every 10 seconds for session expiration
    const intervalId = setInterval(() => {
      const lastActivity = sessionStorage.getItem('lastActivity');
      if (lastActivity) {
        const timeDiff = Date.now() - parseInt(lastActivity, 10);
        if (timeDiff >= SESSION_TIMEOUT_MS) {
          dispatch(logout());
          dispatch(setView('signin'));
        }
      } else {
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

  // Scroll to top on view changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const handleSignInSuccess = (authData) => {
    dispatch(loginSuccess(authData));
    dispatch(setView('overview'));
  };

  const handleLogout = () => {
    dispatch(logout());
    dispatch(setView('signin'));
  };

  const handleNavigate = (newView) => {
    dispatch(setView(newView));
  };

  return (
    <div className="app-layout">
      {view === 'signin' ? (
        <SignInPage 
          onSignIn={handleSignInSuccess} 
          onNavigateToSignUp={() => {
            dispatch(setView('signup'));
          }}
          onNavigateToDeveloper={() => {
            dispatch(setView('superadmin-login'));
          }}
        />
      ) : view === 'signup' ? (
        <SignUpPage 
          onSignUp={handleSignInSuccess}
          onNavigateToSignIn={() => {
            dispatch(setView('signin'));
          }}
        />
      ) : view === 'superadmin-login' ? (
        <SuperadminLoginPage />
      ) : view === 'superadmin' ? (
        <SuperadminDashboard />
      ) : (
        <div className="app-workspace">
          <SideNavbar currentView={view} onViewChange={handleNavigate} onLogout={handleLogout} />
          <div className="main-viewport">
            {view === 'overview' && (
              <OverviewPage onNavigate={handleNavigate} />
            )}
            {view === 'inventory' && (
              <InventoryPage />
            )}
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
          </div>
        </div>
      )}
      <ScrollToTop />
    </div>
  );
}

export default App;
