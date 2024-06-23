import './index.css';
// Import MUI default Roboto font
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import {ThemeProvider} from '@mui/material/styles';
import React from 'react';
import ReactDOM from 'react-dom/client';

import packageJson from '../package.json';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.ts';
import getTheme from './getTheme.ts';

console.log('App Version:', packageJson.version);

const darkTheme = getTheme({mode: 'dark'});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline enableColorScheme />
      <ErrorBoundary
        fallback={(error, moduleName) => (
          <div
            style={{
              padding: 8,
            }}>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
              }}>{`Application encountered an error: ${error.message}\n\nModule Name: ${moduleName}`}</pre>
            <Button
              onClick={() => window.location.reload()}
              variant="contained">
              Reload App
            </Button>
          </div>
        )}>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
