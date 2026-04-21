const UserNotRegisteredError = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>
      <div className="max-w-md w-full p-8" style={{ background: "var(--v1v-surface-1)", border: "1px solid var(--v1v-earth-border)" }}>
        <div className="text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(232,122,0,0.12)" }}>
            <svg className="h-8 w-8" style={{ color: "#E87A00" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.38em]" style={{ color: "rgba(232,122,0,0.7)" }}>
            Accès restreint
          </p>
          <h1 className="mb-4 text-3xl font-black uppercase tracking-[0.08em]" style={{ color: "var(--v1v-fg)" }}>
            Compte non activé
          </h1>
          <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
            Ce compte n&apos;est pas encore autorisé à utiliser cette version de W1LD. Vérifie l&apos;adresse utilisée ou contacte le support si tu penses qu&apos;il s&apos;agit d&apos;une erreur.
          </p>
          <div className="rounded-[16px] p-4 text-left text-sm" style={{ background: "var(--v1v-earth-bg)", border: "1px solid var(--v1v-earth-border)", color: "var(--v1v-fg-muted)" }}>
            <p className="font-black uppercase tracking-[0.18em]" style={{ color: "var(--v1v-fg)" }}>Que faire maintenant</p>
            <ul className="mt-3 space-y-2">
              <li>Vérifie que tu es connecté avec le bon compte.</li>
              <li>Déconnecte-toi puis reconnecte-toi si l&apos;accès vient d&apos;être activé.</li>
              <li>Contacte le support si le problème persiste.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
