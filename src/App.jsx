```jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Providers
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { AuthProvider } from "@/context/AuthContext";

// Pages
import Home from "@/pages/Home";
import Onboarding from "@/pages/Onboarding";
import LiveWorkout from "@/pages/LiveWorkout";
import Program from "@/pages/Program";
import Nutrition from "@/pages/Nutrition";
import Progress from "@/pages/Progress";
import Profile from "@/pages/Profile";
import Kael from "@/pages/Kael";
import ProgressPhotos from "@/pages/ProgressPhotos";
import FormLab from "@/pages/FormLab";
import About from "@/pages/About";
import Contact from "@/pages/Contact";

// Create the React Query client once for the application.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/live-workout" element={<LiveWorkout />} />
              <Route path="/program" element={<Program />} />
              <Route path="/nutrition" element={<Nutrition />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/kael" element={<Kael />} />
              <Route path="/photos" element={<ProgressPhotos />} />
              <Route path="/formlab" element={<FormLab />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />

              {/* Unknown URLs return to the home page. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
```
