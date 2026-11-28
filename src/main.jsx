import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/theme.css';
import { AppProvider } from './context/AppContext';
import { DataProvider } from './context/DataContext';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
