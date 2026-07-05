import { useState } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import NewBatchPage from './components/NewBatchPage'
import ResultsPage from './components/ResultsPage'
import bannerLeft from './assets/banner_left.jpg'
import bannerRight from './assets/banner_right.jpg'

function App() {
  const [view, setView] = useState('inputs') // 'inputs' or 'results'
  const [optimizationData, setOptimizationData] = useState(null)


  //hello
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
              }} />
            </div>
            <aside className="banner-sidebar right-sidebar">
              <a href="https://cravorasolutions.com/" target="_blank" rel="noopener noreferrer">
                <img src={bannerRight} alt="Cravora Solutions Right" />
              </a>
            </aside>
          </div>
        ) : (
          <ResultsPage data={optimizationData} onBack={() => setView('inputs')} />
        )}
      </div>
    </div>
  )
}

export default App
