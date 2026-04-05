import { Suspense, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ScrollProvider } from '@/lib/ScrollContext';
import { NavHistoryProvider } from '@/lib/NavHistory';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Badges from './pages/Badges';
import { syncOfflineQueue } from './utils/syncQueue';
import AdminMap from './pages/AdminMap';
import AdminSecurity from './pages/AdminSecurity';
import TerritorialMap from './pages/TerritorialMap';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Sync offline queue au montage global (après auth)
  useEffect(() => {
    if (!isLoadingAuth && !authError && navigator.onLine) {
      syncOfflineQueue().catch(() => {});
    }
  }, [isLoadingAuth, authError]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--v1v-bg)" }}>
                  <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--v1v-green)", borderTopColor: "transparent" }} />
                </div>
              }>
                <Page />
              </Suspense>
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/Badges" element={<LayoutWrapper currentPageName="Badges"><Badges /></LayoutWrapper>} />
      <Route path="/TerritorialMap" element={<LayoutWrapper currentPageName="TerritorialMap"><TerritorialMap /></LayoutWrapper>} />
      <Route path="/AdminMap" element={<LayoutWrapper currentPageName="AdminMap"><AdminMap /></LayoutWrapper>} />
      <Route path="/AdminSecurity" element={<LayoutWrapper currentPageName="AdminSecurity"><AdminSecurity /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <ScrollProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavHistoryProvider>
            <NavigationTracker />
            <AuthenticatedApp />
          </NavHistoryProvider>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ScrollProvider>
    </AuthProvider>
  )
}

export default App