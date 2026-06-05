import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RecordsPage from './pages/RecordsPage';
import ConnectPage from './pages/ConnectPage';
import ProviderSelectPage from './pages/ProviderSelectPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import RedactionStudioPage from './pages/RedactionStudioPage';
import DataBrowserPage from './pages/DataBrowserPage';
import SiteFooter from './components/SiteFooter';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />

            {/* Records hub (standalone) */}
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/records/add" element={<ProviderSelectPage />} />
            <Route path="/records/callback" element={<OAuthCallbackPage />} />
            <Route path="/records/redaction" element={<RedactionStudioPage />} />
            <Route path="/records/browser" element={<DataBrowserPage />} />

            {/* AI session flow */}
            <Route path="/connect/:sessionId" element={<ConnectPage />} />

            {/* OAuth callback (shared) */}
            <Route path="/connect/callback" element={<OAuthCallbackPage />} />

            {/* Catch-all: redirect unknown paths to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </BrowserRouter>
  );
}
