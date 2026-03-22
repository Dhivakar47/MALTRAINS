import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Dashboard } from "@/pages/Dashboard";
import { DataEntry } from "@/pages/DataEntry";
import { ReportIncident } from "@/pages/ReportIncident";
import { Attendance } from "@/pages/Attendance";
import { Alerts } from "@/pages/Alerts";
import { AdminSettings } from "@/pages/AdminSettings";
import { TrainLogs } from "@/pages/TrainLogs";
import { FitnessRenewal } from "@/pages/FitnessRenewal";
import { PredictiveMaintenance } from "@/pages/PredictiveMaintenance";
import { LiveMap } from "@/pages/LiveMap";
import NotFound from "./pages/NotFound";

import { ThemeProvider } from "@/components/ThemeProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider defaultTheme="dark" storageKey="maltrains-theme" attribute="class">
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/data-entry" element={<DataEntry />} />
              <Route path="/report-incident" element={<ReportIncident />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/admin-settings" element={<AdminSettings />} />
              <Route path="/train-logs" element={<TrainLogs />} />
              <Route path="/fitness-renewal" element={<FitnessRenewal />} />
              <Route path="/predictive-maintenance" element={<PredictiveMaintenance />} />
              <Route path="/live-map" element={<LiveMap />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
