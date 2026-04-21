/**
 * pages.config.js - Page routing configuration
 */
import { lazy } from 'react';
import __Layout from './Layout.jsx';
import { isFeatureEnabled } from '@/lib/app-config';

const Collection     = lazy(() => import('./pages/Collection'));
const Friends        = lazy(() => import('./pages/Friends'));
const Home           = lazy(() => import('./pages/Home'));
const Leaderboard    = lazy(() => import('./pages/Leaderboard'));
const Onboarding     = lazy(() => import('./pages/Onboarding'));
const Profile        = lazy(() => import('./pages/Profile'));
const TerritorialMap = lazy(() => import('./pages/TerritorialMap'));
const AdminImport = isFeatureEnabled("adminImport")
  ? lazy(() => import('./pages/AdminImport'))
  : null;
const KnowledgeMap = isFeatureEnabled("knowledgeMap")
  ? lazy(() => import('./pages/KnowledgeMap'))
  : null;
const AncientCalendar = isFeatureEnabled("ancientCalendar")
  ? lazy(() => import('./pages/AncientCalendar'))
  : null;
const NightSky = isFeatureEnabled("nightSky")
  ? lazy(() => import('./pages/NightSky'))
  : null;
const Pricing = isFeatureEnabled("pricing")
  ? lazy(() => import('./pages/Pricing'))
  : null;


export const PAGES = {
    "Collection":     Collection,
    "Friends":        Friends,
    "Home":           Home,
    "Leaderboard":    Leaderboard,
    "Onboarding":     Onboarding,
    "Profile":        Profile,
    "TerritorialMap": TerritorialMap,
    ...(AdminImport ? { "AdminImport": AdminImport } : {}),
    ...(KnowledgeMap ? { "KnowledgeMap": KnowledgeMap } : {}),
    ...(AncientCalendar ? { "AncientCalendar": AncientCalendar } : {}),
    ...(NightSky ? { "NightSky": NightSky } : {}),
    ...(Pricing ? { "Pricing": Pricing } : {}),
};

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
