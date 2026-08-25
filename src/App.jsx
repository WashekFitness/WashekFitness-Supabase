# `src/App.jsx`

```jsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import AppLayout from "@/components/AppLayout";
import PageNotFound from "@/pages/PageNotFound";

const Program = lazy(() => import("@/pages/Program"));
const Nutrition = lazy(() => import("@/pages/Nutrition"));
const Progress = lazy(() => import("@/pages/Progress"));
const Profile = lazy(() => import("@/pages/Profile"));
const Kael = lazy(() => import("@/pages/Kael"));
const ProgressPhotos = lazy(() => import("@/pages/ProgressPhotos"));
const FormLab = lazy(() => import("@/pages/FormLab"));
const ProgramDay = lazy(() => import("@/pages/ProgramDay"));
const LiveWorkout = lazy(() => import("@/pages/LiveWorkout"));
const SubscriptionReturn = lazy(() => import("@/pages/SubscriptionReturn"));

const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      Loading...
    </div>
  );
}

function AuthenticatedApp() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#000",
          color: "#fff",
          fontFamily: "sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <h1>Authentication Error</h1>
          <p>{error.message || "Unable to load authentication."}</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public authentication page */}
        <Route
          path="/login"
          element={
            user ? <Navigate to="/" replace /> : <Login />
          }
        />

        {/* Public onboarding route */}
        <Route
          path="/onboarding"
          element={
            user ? <Onboarding /> : <Navigate to="/login" replace />
          }
        />

        {/* Workout / subscription routes */}
        <Route
          path="/live-workout"
          element={
            user ? <LiveWorkout /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/subscription-return"
          element={
            user ? (
              <SubscriptionReturn />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Main authenticated application */}
        <Route
          element={
            user ? <AppLayout /> : <Navigate to="/login" replace />
          }
        >
          <Route path="/" element={<Program />} />
          <Route path="/program" element={<Program />} />
          <Route path="/program/day/:dayIndex" element={<ProgramDay />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/kael" element={<Kael />} />
          <Route path="/photos" element={<ProgressPhotos />} />
          <Route path="/formlab" element={<FormLab />} />
          <Route path="/about" element={<div>About</div>} />
          <Route path="/contact" element={<div>Contact</div>} />
        </Route>

        {/* Catch unknown routes */}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AppSettingsProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>

          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </AppSettingsProvider>
  );
}

/*
 * IMPORTANT:
 * main.jsx imports App as a DEFAULT import:
 *
 * import App from "@/App.jsx";
 *
 * Therefore App.jsx MUST have a default export.
 */
export default App;
```
