import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Protected } from './components/Protected';
import { Shell } from './components/Shell';
import { Spinner } from './ui';

// Auth
const LoginPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import('./pages/AuthPages').then((m) => ({ default: m.RegisterPage })),
);

// Creator
const DashboardPage = lazy(() => import('./pages/creator/DashboardPage'));
const ExperienceNewPage = lazy(() => import('./pages/creator/ExperienceNewPage'));
const ExperienceLayout = lazy(() => import('./pages/creator/ExperienceLayout'));
const SettingsPage = lazy(() => import('./pages/creator/SettingsPage'));
const BuilderPage = lazy(() => import('./pages/creator/BuilderPage'));
const MemoriesPage = lazy(() => import('./pages/creator/MemoriesPage'));
const OpenWhenPage = lazy(() => import('./pages/creator/OpenWhenPage'));
const FutureLetterPage = lazy(() => import('./pages/creator/FutureLetterPage'));
const FinalSurprisePage = lazy(() => import('./pages/creator/FinalSurprisePage'));
const MediaPage = lazy(() => import('./pages/creator/MediaPage'));
const ThemePage = lazy(() => import('./pages/creator/ThemePage'));
const CustomizePage = lazy(() => import('./pages/creator/CustomizePage'));
const ResponsesPage = lazy(() => import('./pages/creator/ResponsesPage'));
const SharePage = lazy(() => import('./pages/creator/SharePage'));
const PreviewPage = lazy(() => import('./pages/creator/PreviewPage'));

// Recipient
const EnvelopePage = lazy(() => import('./pages/recipient/EnvelopePage'));
const PinPage = lazy(() => import('./pages/recipient/PinPage'));
const ExperiencePage = lazy(() => import('./pages/recipient/ExperiencePage'));

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function PageFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
      <Spinner label="Loading" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Creator — chrome + auth */}
        <Route
          element={
            <Protected>
              <Shell />
            </Protected>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/experiences" element={<Navigate to="/dashboard" replace />} />
          <Route path="/experiences/new" element={<ExperienceNewPage />} />

          <Route path="/experiences/:id" element={<ExperienceLayout />}>
            <Route index element={<Navigate to="edit" replace />} />
            <Route path="edit" element={<BuilderPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="memories" element={<MemoriesPage />} />
            <Route path="open-when" element={<OpenWhenPage />} />
            <Route path="future-letter" element={<FutureLetterPage />} />
            <Route path="surprise" element={<FinalSurprisePage />} />
            <Route path="media" element={<MediaPage />} />
            <Route path="theme" element={<ThemePage />} />
            <Route path="customize" element={<CustomizePage />} />
            <Route path="responses" element={<ResponsesPage />} />
            <Route path="share" element={<SharePage />} />
          </Route>
        </Route>

        {/* Preview runs the real recipient renderer, without the creator chrome. */}
        <Route
          path="/experiences/:id/preview"
          element={
            <Protected>
              <PreviewPage />
            </Protected>
          }
        />

        {/* Recipient — no auth, no chrome */}
        <Route path="/e/:token" element={<EnvelopePage />} />
        <Route path="/e/:token/pin" element={<PinPage />} />
        <Route path="/e/:token/open" element={<ExperiencePage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
