import React from 'react'
import ReactDOM from 'react-dom/client'
import { FluentProvider, teamsLightTheme } from '@fluentui/react-components'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FluentProvider
      theme={teamsLightTheme}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <App />
    </FluentProvider>
  </React.StrictMode>
)
