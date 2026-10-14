import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TelemetryProvider, useTelemetry } from './context/TelemetryContext';
import { Header } from './components/Header';
import { RackTwinElevation } from './components/RackTwinElevation';
import { ActionHub } from './components/ActionHub';
import { IntelligenceConsole } from './components/IntelligenceConsole';
import { AISandboxModal } from './components/AISandboxModal';
import { ServerInspectorModal } from './components/ServerInspectorModal';
import { AuthGateModal } from './components/AuthGateModal';

import { IncidentDetailModal } from './components/IncidentDetailModal';
import { ToastNotification } from './components/ToastNotification';

function Dashboard() {
  const { 
    selectedServer, 
    setSelectedServer, 
    activeRackId,
    selectedIncidentForReview,
    setSelectedIncidentForReview,
    toasts,
    dismissToast
  } = useTelemetry();
  const { isAuthenticated } = useAuth();

  // Modal visibility state
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Enterprise Authentication Gate Modal (When user logs out or session is unauthenticated) */}
      <AuthGateModal isOpen={!isAuthenticated} />

      {/* Top Navigation & Global Telemetry Header */}
      <Header
        onOpenSandbox={() => setIsSandboxOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
      />

      {/* Main Workspace Dashboard Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Section 1 - 2D Rack Elevations U1 to U42 & Live Thermal Heatmaps */}
        <section className="lg:col-span-7 xl:col-span-7">
          <RackTwinElevation />
        </section>

        {/* Right Column (5 cols): Section 3 - The Action Hub (Autonomous Decision Queue & Remediation) */}
        <section className="lg:col-span-5 xl:col-span-5 sticky top-28 self-start flex flex-col">
          <ActionHub />
        </section>
      </main>

      {/* Slide-over: Intelligence Console (Copilot chat window to pull information) */}
      <IntelligenceConsole
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      {/* Modal: AI Remediation Sandbox (Interactive Target Server Dropdown & Fault Injection) */}
      <AISandboxModal
        isOpen={isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
      />

      {/* Modal: Server Deep-Dive Inspector */}
      <ServerInspectorModal
        server={selectedServer}
        rackId={activeRackId}
        onClose={() => setSelectedServer(null)}
      />

      {/* Expandable Incident Detail Review Modal */}
      <IncidentDetailModal
        incident={selectedIncidentForReview}
        onClose={() => setSelectedIncidentForReview(null)}
      />

      {/* Global Alert System Toast Notifications */}
      <ToastNotification
        toasts={toasts}
        onDismiss={dismissToast}
        onReview={(inc) => setSelectedIncidentForReview(inc)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TelemetryProvider>
        <Dashboard />
      </TelemetryProvider>
    </AuthProvider>
  );
}
