import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Pipeline from './pages/Pipeline';
import Inbox from './pages/Inbox';
import Analytics from './pages/Analytics';
import Campaigns from './pages/Campaigns';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import Contacts from './pages/Contacts';
import Companies from './pages/Companies';

import Agenda from './pages/Agenda';
import CommandCenter from './pages/CommandCenter';
import { ToastProvider } from './components/ToastProvider';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Pipeline />} />
            <Route path="brain" element={<CommandCenter />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="companies" element={<Companies />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />

            {/* Redirects for legacy/alternate routes */}
            <Route path="leads" element={<Navigate to="/contacts" replace />} />
            <Route path="reports" element={<Navigate to="/analytics" replace />} />
            <Route path="pipeline" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

