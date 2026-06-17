import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TodayTasks from './TodayTasks'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TodayTasks />
  </StrictMode>
)
