import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HeroUIProvider } from '@heroui/react'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'

// Apply initial theme before render to avoid flash
const storedTheme = localStorage.getItem('chester-theme')
const isDark = storedTheme ? storedTheme === 'dark' : true
if (isDark) {
  document.documentElement.classList.add('dark')
  document.body.classList.add('dark')
  document.body.style.backgroundColor = '#0a0a0a'
} else {
  document.body.style.backgroundColor = '#f9fafb'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <HeroUIProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </HeroUIProvider>
    </BrowserRouter>
  </StrictMode>,
)
