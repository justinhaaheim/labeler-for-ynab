import './index.css';
// Import MUI default Roboto font
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/inter';

import Button from '@mui/joy/Button';
import CssBaseline from '@mui/joy/CssBaseline';
import {CssVarsProvider} from '@mui/joy/styles';
import React from 'react';
import ReactDOM from 'react-dom/client';

import packageJson from '../package.json';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.ts';

console.log('App Version:', packageJson.version);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CssVarsProvider defaultMode="dark">
      <CssBaseline />
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
            <Button onClick={() => window.location.reload()} variant="solid">
              Reload App
            </Button>
          </div>
        )}>
        <App />
      </ErrorBoundary>
    </CssVarsProvider>
  </React.StrictMode>,
);
