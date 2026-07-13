import { useState, useEffect } from 'react'
import './App.css'
import SideNavbar from './components/SideNavbar/SideNavbar'
import NewBatchPage from './pages/NewBatchPage/NewBatchPage'
import ResultsPage from './pages/ResultsPage/ResultsPage'
import SignInPage from './pages/SignInPage/SignInPage'
import SignUpPage from './pages/SignUpPage/SignUpPage'
import OverviewPage from './pages/OverviewPage/OverviewPage'
import InventoryPage from './pages/InventoryPage/InventoryPage'
import BatchHistoryPage from './pages/BatchHistoryPage/BatchHistoryPage'
import LedgerPage from './pages/LedgerPage/LedgerPage'
import ScrollToTop from './components/ScrollToTop/ScrollToTop'

function App() {
  const [view, setView] = useState('signin') // 'signin', 'signup', 'overview', 'inventory', 'inputs', 'results', 'history'
  const [optimizationData, setOptimizationData] = useState(null)
  const [_user, setUser] = useState(null)

  // ponytail: Restore session from localStorage on mount.
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const storedUser = localStorage.getItem('user')
    if (token && storedUser) {
      setUser(JSON.parse(storedUser))
      setView('overview')
      window.history.replaceState({ view: 'overview' }, '')
    } else {
      window.history.replaceState({ view: 'signin' }, '')
    }

    const handlePopState = (event) => {
      const tokenExists = localStorage.getItem('accessToken')
      if (event.state && event.state.view) {
        // Protected routes check
        if (!tokenExists && event.state.view !== 'signin' && event.state.view !== 'signup') {
          setView('signin')
          window.history.replaceState({ view: 'signin' }, '')
        } else {
          setView(event.state.view)
        }
      } else {
        setView(tokenExists ? 'overview' : 'signin')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  const handleSignInSuccess = (authData) => {
    localStorage.setItem('accessToken', authData.accessToken)
    localStorage.setItem('user', JSON.stringify(authData.user))
    setUser(authData.user)
    setView('overview')
    window.history.pushState({ view: 'overview' }, '')
  }

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    setUser(null)
    setView('signin')
    window.history.pushState({ view: 'signin' }, '')
  }

  const handleNavigate = (newView) => {
    setView(newView)
    window.history.pushState({ view: newView }, '')
  }

  return (
    <div className="app-layout">
      {view === 'signin' ? (
        <SignInPage 
          onSignIn={handleSignInSuccess} 
          onNavigateToSignUp={() => {
            setView('signup')
            window.history.pushState({ view: 'signup' }, '')
          }}
        />
      ) : view === 'signup' ? (
        <SignUpPage 
          onSignUp={handleSignInSuccess}
          onNavigateToSignIn={() => {
            setView('signin')
            window.history.pushState({ view: 'signin' }, '')
          }}
        />
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
                setOptimizationData(data)
                setView('results')
                window.history.pushState({ view: 'results' }, '')
              }} />
            )}
            {view === 'results' && (
              <ResultsPage 
                data={optimizationData} 
                onBack={() => {
                  setView('inputs')
                  window.history.pushState({ view: 'inputs' }, '')
                }}
                onSaveSuccess={() => {
                  setView('history')
                  window.history.pushState({ view: 'history' }, '')
                }}
              />
            )}
            {view === 'history' && (
              <BatchHistoryPage />
            )}
            {view === 'ledger' && (
              <LedgerPage />
            )}
          </div>
        </div>
      )}
      <ScrollToTop />
    </div>
  )
}

export default App
