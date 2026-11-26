import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/theme.css';
import { AppProvider } from './context/AppContext';
import { DataProvider } from './context/DataContext';
import App from './App';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </AppProvider>
  </React.StrictMode>
);
