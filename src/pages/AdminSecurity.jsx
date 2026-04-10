import { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Shield, CheckCircle, X } from 'lucide-react';

export default function AdminSecurity() {
  const [suspects, setSuspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, critical, flagged, normal

  useEffect(() => {
    const fetchSuspects = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        // Note: vérification du rôle admin à implémenter via Supabase custom claims
        if (!user) { setSuspects([]); setLoading(false); return; }

        const { data: trustScores } = await supabase
          .from('user_trust_scores')
          .select('*')
          .order('trust_score', { ascending: true })
          .limit(100);

        const filtered = trustScores.filter(ts => {
          if (filter === 'all') return true;
          if (filter === 'critical') return ts.trust_score < 30;
          if (filter === 'flagged') return ts.trust_score >= 30 && ts.trust_score < 70;
          if (filter === 'normal') return ts.trust_score >= 70;
          return true;
        });

        setSuspects(filtered);
      } catch (error) {
        console.error('Error fetching suspects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuspects();
  }, [filter]);

  const handleBlockUser = async (trustId) => {
    try {
      await supabase.from('user_trust_scores').update({
        trust_score: 0,
        blocked_until: new Date(Date.now() + 86400000).toISOString(),
      }).eq('id', trustId);
      setSuspects(s => s.map(su => su.id === trustId ? { ...su, trust_score: 0 } : su));
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const handleResetScore = async (trustId) => {
    try {
      await supabase.from('user_trust_scores').update({
        trust_score: 100,
        violations: { speed_anomalies: 0, spam_incidents: 0, farming_attempts: 0, suspicious_patterns: 0 },
        surveillance_active: false,
        blocked_until: null,
      }).eq('id', trustId);
      setSuspects(s => s.map(su => su.id === trustId ? { ...su, trust_score: 100, violations: { speed_anomalies: 0, spam_incidents: 0, farming_attempts: 0, suspicious_patterns: 0 }, surveillance_active: false } : su));
    } catch (error) {
      console.error('Error resetting score:', error);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--v1v-bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--v1v-green)', borderTopColor: 'transparent' }} />
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
        <div className="space-y-3">
          {suspects.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Aucun utilisateur à afficher
            </div>
          ) : (
            suspects.map(suspect => {
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
                        onClick={() => handleResetScore(suspect.id, suspect.user_email)}
                        className="p-2 rounded hover:bg-green-900/20 transition"
                        title="Marquer comme légitime"
                      >
                        <CheckCircle className="w-5 h-5" style={{ color: 'var(--v1v-green)' }} />
                      </button>
                      <button
                        onClick={() => handleBlockUser(suspect.id)}
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