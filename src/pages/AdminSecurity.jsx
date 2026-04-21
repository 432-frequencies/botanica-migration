import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { createApiUrl } from "@/lib/app-config";
import { Shield, CheckCircle, X } from 'lucide-react';
import { useAdminStatus } from '@/hooks/useAdminStatus';

export default function AdminSecurity() {
  const [suspects, setSuspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, critical, flagged, normal
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const { checking: adminChecking, isAdmin } = useAdminStatus();

  useEffect(() => {
    if (adminChecking) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const fetchSuspects = async () => {
      setLoading(true);
      setError('');
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Session admin requise.');
        }

        const response = await fetch(createApiUrl('/api/admin-security'), {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Impossible de charger les signaux de sécurité');
        }

        setSuspects(payload.trustScores || []);
      } catch (nextError) {
        console.error('Error fetching suspects:', nextError);
        setError(nextError?.message || 'Impossible de charger les signaux de sécurité');
      } finally {
        setLoading(false);
      }
    };

    fetchSuspects();
  }, [adminChecking, isAdmin]);

  const runAdminAction = async (action, trustId) => {
    setBusyId(`${action}:${trustId}`);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Session admin requise.');
      }

      const response = await fetch(createApiUrl('/api/admin-security'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, trustId }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Impossible d’appliquer cette action');
      }

      setSuspects(payload.trustScores || []);
    } catch (nextError) {
      console.error('Error applying admin action:', nextError);
      setError(nextError?.message || 'Impossible d’appliquer cette action');
    } finally {
      setBusyId('');
    }
  };

  const handleBlockUser = (trustId) => runAdminAction('block-user', trustId);
  const handleResetScore = (trustId) => runAdminAction('reset-score', trustId);

  const getRiskColor = (score) => {
    if (score < 10) return 'text-red-500';
    if (score < 30) return 'text-orange-500';
    if (score < 50) return 'text-yellow-500';
    if (score < 70) return 'text-blue-500';
    return 'text-green-500';
  };

  const getRiskLevel = (score) => {
    if (score < 10) return { level: 'BLOQUÉ', color: 'bg-red-900/20 border-red-500/30' };
    if (score < 30) return { level: 'CRITIQUE', color: 'bg-orange-900/20 border-orange-500/30' };
    if (score < 50) return { level: 'SUSPECT', color: 'bg-yellow-900/20 border-yellow-500/30' };
    if (score < 70) return { level: 'SURVEILLANCE', color: 'bg-blue-900/20 border-blue-500/30' };
    return { level: 'NORMAL', color: 'bg-green-900/20 border-green-500/30' };
  };

  const filteredSuspects = useMemo(() => (
    suspects.filter((ts) => {
      if (filter === 'all') return true;
      if (filter === 'critical') return ts.trust_score < 30;
      if (filter === 'flagged') return ts.trust_score >= 30 && ts.trust_score < 70;
      if (filter === 'normal') return ts.trust_score >= 70;
      return true;
    })
  ), [filter, suspects]);

  if (adminChecking || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--v1v-bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--v1v-green)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--v1v-bg)' }}>
        <div className="max-w-md p-6 text-center" style={{ border: '1px solid rgba(57,255,20,0.15)', background: 'rgba(57,255,20,0.03)' }}>
          <Shield className="w-8 h-8 mx-auto mb-4" style={{ color: 'rgba(57,255,20,0.45)' }} />
          <p className="text-xs font-black uppercase tracking-[0.34em] mb-2" style={{ color: 'rgba(57,255,20,0.55)' }}>
            Console verrouillée
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,224,208,0.68)' }}>
            Cette vue est réservée à un compte administrateur vérifié côté serveur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--v1v-bg)' }} className="min-h-screen pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-6 h-6" style={{ color: 'var(--v1v-green)' }} />
          <h1 className="text-2xl font-black uppercase tracking-wider" style={{ color: 'var(--v1v-green)' }}>
            Sécurité
          </h1>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'critical', label: 'Critiques' },
            { key: 'flagged', label: 'Suspects' },
            { key: 'normal', label: 'Normal' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wider transition ${
                filter === f.key
                  ? 'border-2'
                  : 'border border-gray-600'
              }`}
              style={{
                borderColor: filter === f.key ? 'var(--v1v-green)' : undefined,
                color: filter === f.key ? 'var(--v1v-green)' : 'var(--v1v-fg-muted)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {error && (
          <div className="mb-4 px-4 py-3" style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF6B6B' }}>
            {error}
          </div>
        )}

        <div className="space-y-3">
          {filteredSuspects.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Aucun utilisateur à afficher
            </div>
          ) : (
            filteredSuspects.map(suspect => {
              const risk = getRiskLevel(suspect.trust_score);
              const violations = suspect.violations || {};
              return (
                <div
                  key={suspect.id}
                  className={`border rounded-lg p-4 ${risk.color}`}
                  style={{ background: 'var(--v1v-surface-1)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-sm uppercase tracking-wider" style={{ color: 'var(--v1v-fg)' }}>
                          {suspect.user_email}
                        </span>
                        <span className={`text-xs font-black uppercase tracking-wider px-2 py-1 rounded border ${risk.color}`}>
                          {risk.level}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        <div>
                          <div className="text-xs text-gray-400 uppercase">Score</div>
                          <div className={`text-2xl font-black ${getRiskColor(suspect.trust_score)}`}>
                            {suspect.trust_score}
                          </div>
                        </div>

                        {/* Barre de progression */}
                        <div className="flex-1">
                          <div className="h-2 bg-gray-800 rounded overflow-hidden">
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${suspect.trust_score}%`,
                                background: suspect.trust_score < 30 ? '#ef4444' : suspect.trust_score < 70 ? '#f59e0b' : 'var(--v1v-green)',
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Violations */}
                      {Object.keys(violations).some(k => violations[k] > 0) && (
                        <div className="flex gap-2 flex-wrap text-xs">
                          {violations.speed_anomalies > 0 && (
                            <span className="px-2 py-1 bg-red-900/30 border border-red-500/30 rounded">
                              Vitesse: {violations.speed_anomalies}
                            </span>
                          )}
                          {violations.spam_incidents > 0 && (
                            <span className="px-2 py-1 bg-orange-900/30 border border-orange-500/30 rounded">
                              Spam: {violations.spam_incidents}
                            </span>
                          )}
                          {violations.farming_attempts > 0 && (
                            <span className="px-2 py-1 bg-yellow-900/30 border border-yellow-500/30 rounded">
                              Farming: {violations.farming_attempts}
                            </span>
                          )}
                          {violations.suspicious_patterns > 0 && (
                            <span className="px-2 py-1 bg-blue-900/30 border border-blue-500/30 rounded">
                              Suspect: {violations.suspicious_patterns}
                            </span>
                          )}
                        </div>
                      )}

                      {suspect.last_violation && (
                        <div className="text-xs text-gray-400 mt-2">
                          Dernière violation: {new Date(suspect.last_violation).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResetScore(suspect.id)}
                        disabled={busyId === `reset-score:${suspect.id}`}
                        className="p-2 rounded hover:bg-green-900/20 transition"
                        title="Marquer comme légitime"
                      >
                        <CheckCircle className="w-5 h-5" style={{ color: 'var(--v1v-green)' }} />
                      </button>
                      <button
                        onClick={() => handleBlockUser(suspect.id)}
                        disabled={busyId === `block-user:${suspect.id}`}
                        className="p-2 rounded hover:bg-red-900/20 transition"
                        title="Bloquer"
                      >
                        <X className="w-5 h-5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
