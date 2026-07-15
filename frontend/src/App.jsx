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
import SuperadminLoginPage from './pages/SuperadminLoginPage/SuperadminLoginPage';
import SuperadminDashboard from './pages/SuperadminDashboard/SuperadminDashboard';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { setView, syncViewFromPopState } from './store/slices/routingSlice';
import { loginSuccess, logout } from './store/slices/authSlice';

function App() {
  const dispatch = useDispatch();
  const view = useSelector((state) => state.routing.view);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const [optimizationData, setOptimizationData] = useState(null);

  // Synchronize route session on mount and handle PopState events
  useEffect(() => {
    // Initial theme set from settings
    const storedThemeMode = localStorage.getItem('themeMode') || 'dark';
    const storedThemeColor = localStorage.getItem('themeColor') || 'slate-emerald';
    document.documentElement.setAttribute('data-theme', storedThemeMode);
    document.documentElement.setAttribute('data-color-theme', storedThemeColor);

    const handlePopState = (event) => {
      const tokenExists = localStorage.getItem('accessToken');
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
              <NewBatchPage onOptimize={(data) => {
                setOptimizationData(data);
                dispatch(setView('results'));
              }} />
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
              <BatchHistoryPage />
            )}
            {view === 'ledger' && (
              <LedgerPage />
            )}
            {view === 'settings' && (
              <SettingsPage />
            )}
          </div>
        </div>
      )}
      <ScrollToTop />
    </div>
  );
}

export default App;
