import { useState, useEffect } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import NewBatchPage from './components/NewBatchPage'
import ResultsPage from './components/ResultsPage'
import bannerLeft from './assets/banner_left.jpg'
import bannerRight from './assets/banner_right.jpg'

function App() {
  const [view, setView] = useState('inputs') // 'inputs' or 'results'
  const [optimizationData, setOptimizationData] = useState(null)

  // ponytail: Using native popstate history navigation to handle back button without router dependency.
  // Ceiling: App doesn't support complex URLs/sub-routes. Upgrade path: Use react-router-dom if routing needs grow.
  useEffect(() => {
    window.history.replaceState({ view: 'inputs' }, '')

    const handlePopState = (event) => {
      if (event.state && event.state.view === 'results') {
        setView('results')
      } else {
        setView('inputs')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <div className="app-layout">
      <Navbar />
      <div className="page-content">
        {view === 'inputs' ? (
          <div className="optimizer-workspace">
            <aside className="banner-sidebar left-sidebar">
              <a href="https://cravorasolutions.com/" target="_blank" rel="noopener noreferrer">
                <img src={bannerLeft} alt="Cravora Solutions Left" />
              </a>
            </aside>
            <div className="main-content-container">
              <NewBatchPage onOptimize={(data) => {
                setOptimizationData(data)
                setView('results')
                window.history.pushState({ view: 'results' }, '')
              }} />
            </div>
            <aside className="banner-sidebar right-sidebar">
              <a href="https://cravorasolutions.com/" target="_blank" rel="noopener noreferrer">
                <img src={bannerRight} alt="Cravora Solutions Right" />
              </a>
            </aside>
          </div>
        ) : (
          <ResultsPage data={optimizationData} onBack={() => window.history.back()} />
        )}
      </div>
    </div>
  )
}

export default App

