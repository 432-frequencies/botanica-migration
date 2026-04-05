/**
 * pages.config.js - Page routing configuration
 */
import { lazy } from 'react';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import __Layout from './Layout.jsx';

const AdminImport    = lazy(() => import('./pages/AdminImport'));
const AncientCalendar = lazy(() => import('./pages/AncientCalendar'));
const Collection     = lazy(() => import('./pages/Collection'));
const KnowledgeMap   = lazy(() => import('./pages/KnowledgeMap'));
const Leaderboard    = lazy(() => import('./pages/Leaderboard'));
const NightSky       = lazy(() => import('./pages/NightSky'));
const Pricing        = lazy(() => import('./pages/Pricing'));
const Profile        = lazy(() => import('./pages/Profile'));
const TerritorialMap = lazy(() => import('./pages/TerritorialMap'));


export const PAGES = {
    "AdminImport":    AdminImport,
    "AncientCalendar": AncientCalendar,
    "Collection":     Collection,
    "Home":           Home,
    "KnowledgeMap":   KnowledgeMap,
    "Leaderboard":    Leaderboard,
    "NightSky":       NightSky,
    "Onboarding":     Onboarding,
    "Pricing":        Pricing,
    "Profile":        Profile,
    "TerritorialMap": TerritorialMap,

};

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};