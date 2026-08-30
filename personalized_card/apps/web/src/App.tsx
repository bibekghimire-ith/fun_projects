import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { DashboardPage, ExperienceListPage } from './pages/DashboardPage';
import { Protected } from './components/Protected';
import { Shell } from './components/Shell';
import { ExperienceNewPage } from './pages/ExperienceNewPage';
import { ExperienceEditPage } from './pages/ExperienceEditPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      {/* Creator Routes */}
      <Route element={<Protected><Shell /></Protected>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/experiences" element={<ExperienceListPage />} />
        <Route path="/experiences/new" element={<ExperienceNewPage />} />
        <Route path="/experiences/:id/edit" element={<ExperienceEditPage />} />
        <Route path="/experiences/:id/share" element={<div>Share Experience</div>} />
      </Route>
      
      {/* Recipient Routes */}
      <Route path="/e/:token" element={<div>Envelope</div>} />
      <Route path="/e/:token/pin" element={<div>PIN Gate</div>} />
      <Route path="/e/:token/open" element={<div>Experience</div>} />
      
      <Route path="*" element={<div>404 Not Found</div>} />
    </Routes>
  );
}
