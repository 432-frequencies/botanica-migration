import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDone('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setDone('Compte créé — tu peux te connecter.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else navigate('/', { replace: true });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050A05', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <h1 style={{ color: '#39FF14', fontWeight: 900, fontSize: '2rem', textTransform: 'uppercase', marginBottom: '8px' }}>W1LD</h1>
        <p style={{ color: 'rgba(57,255,20,0.4)', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '32px' }}>
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </p>

        {done ? (
          <>
            <p style={{ color: '#39FF14', fontSize: '14px', marginBottom: '16px' }}>{done}</p>
            <button onClick={() => { setDone(''); setMode('login'); }} style={{ color: 'rgba(57,255,20,0.6)', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              → Se connecter
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email"
              required
              style={{ width: '100%', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.3)', color: '#E8E0D0', padding: '12px', fontSize: '14px', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="mot de passe"
              required
              style={{ width: '100%', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.3)', color: '#E8E0D0', padding: '12px', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
            />
            {error && <p style={{ color: '#FF4444', fontSize: '12px', marginBottom: '8px' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: '#39FF14', color: '#050A05', fontWeight: 900, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.3em', padding: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginBottom: '16px' }}
            >
              {loading ? '...' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
            </button>
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              style={{ color: 'rgba(57,255,20,0.5)', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
