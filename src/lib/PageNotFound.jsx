import { Link, useLocation } from 'react-router-dom';
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/app-config';

export default function PageNotFound() {
    const location = useLocation();
    const pageName = location.pathname || '/';

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>
            <div className="max-w-md w-full p-6" style={{ background: "var(--v1v-surface-1)", border: "1px solid var(--v1v-green-ghost)" }}>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.45em]" style={{ color: "var(--v1v-green-faint)" }}>{APP_NAME}</p>
                        <h1 className="text-6xl font-black" style={{ color: "var(--v1v-green)" }}>404</h1>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-xl font-black uppercase tracking-[0.08em]" style={{ color: "var(--v1v-fg)" }}>
                            Zone introuvable
                        </h2>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                            Aucun écran ne correspond à <span style={{ color: "var(--v1v-green)" }}>{pageName}</span>.
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                            Si tu pensais ouvrir une vraie page, contacte-nous à <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--v1v-green)" }}>{SUPPORT_EMAIL}</a>.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Link
                            to="/"
                            className="flex min-h-[48px] items-center justify-center text-xs font-black uppercase tracking-[0.25em]"
                            style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
                        >
                            Retour au terrain
                        </Link>
                        <Link
                            to="/support"
                            className="flex min-h-[44px] items-center justify-center text-xs font-black uppercase tracking-[0.25em]"
                            style={{ border: "1px solid var(--v1v-green-ghost)", color: "var(--v1v-green-faint)" }}
                        >
                            Ouvrir le support
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
