import { Suspense, useEffect, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ScrollProvider } from '@/lib/ScrollContext';
import { NavHistoryProvider } from '@/lib/NavHistory';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { syncOfflineQueue } from './utils/syncQueue';
import { getPageAlias, isPublicPath } from '@/lib/app-config';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;
const Badges = lazy(() => import('./pages/Badges'));
const AdminAffiliates = lazy(() => import('./pages/AdminAffiliates'));
const AdminMap = lazy(() => import('./pages/AdminMap'));
const AdminSecurity = lazy(() => import('./pages/AdminSecurity'));
const Login = lazy(() => import('./pages/Login'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Support = lazy(() => import('./pages/Support'));

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AppScreenFallback = () => (
  <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--v1v-bg)" }}>
    <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "var(--v1v-green)", borderTopColor: "transparent" }} />
  </div>
);

const renderLazyPage = (Page) => (
  <Suspense fallback={<AppScreenFallback />}>
    <Page />
  </Suspense>
);

const renderPageElement = (pageName, Page) => (
  <LayoutWrapper currentPageName={pageName}>
    {renderLazyPage(Page)}
  </LayoutWrapper>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const { pathname } = useLocation();
  const isPublicRoute = isPublicPath(pathname);

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
    } else if (authError.type === 'auth_required' && !isPublicRoute) {
      navigateToLogin();
      return null;
    }
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated && !isPublicRoute) {
    return <Navigate to="/login" replace />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={renderLazyPage(Login)} />
      <Route path="/" element={renderPageElement(mainPageKey, MainPage)} />
      <Route path="/privacy" element={renderPageElement("Privacy", Privacy)} />
      <Route path="/privacy.html" element={renderPageElement("Privacy", Privacy)} />
      <Route path="/support" element={renderPageElement("Support", Support)} />
      <Route path="/support.html" element={renderPageElement("Support", Support)} />
      {Object.entries(Pages).flatMap(([path, Page]) => {
        const aliasPath = getPageAlias(path);
        const routes = [
          <Route key={path} path={`/${path}`} element={renderPageElement(path, Page)} />
        ];

        if (aliasPath !== `/${path}`) {
          routes.push(
            <Route key={`${path}-alias`} path={aliasPath} element={renderPageElement(path, Page)} />
          );
        }

        return routes;
      })}
      <Route path="/Badges" element={renderPageElement("Badges", Badges)} />
      <Route path="/badges" element={renderPageElement("Badges", Badges)} />
      <Route path="/AdminAffiliates" element={renderPageElement("AdminAffiliates", AdminAffiliates)} />
      <Route path="/admin-affiliates" element={renderPageElement("AdminAffiliates", AdminAffiliates)} />
      <Route path="/AdminMap" element={renderPageElement("AdminMap", AdminMap)} />
      <Route path="/admin-map" element={renderPageElement("AdminMap", AdminMap)} />
      <Route path="/AdminSecurity" element={renderPageElement("AdminSecurity", AdminSecurity)} />
      <Route path="/admin-security" element={renderPageElement("AdminSecurity", AdminSecurity)} />
      <Route path="/Pricing" element={<Navigate to="/support" replace />} />
      <Route path="/pricing" element={<Navigate to="/support" replace />} />
      <Route path="/NightSky" element={<Navigate to="/" replace />} />
      <Route path="/night-sky" element={<Navigate to="/" replace />} />
      <Route path="/AncientCalendar" element={<Navigate to="/" replace />} />
      <Route path="/ancient-calendar" element={<Navigate to="/" replace />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <ScrollProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
