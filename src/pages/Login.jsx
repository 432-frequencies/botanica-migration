import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050A05', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <h1 style={{ color: '#39FF14', fontWeight: 900, fontSize: '2rem', textTransform: 'uppercase', marginBottom: '8px' }}>W1LD</h1>
        <p style={{ color: 'rgba(57,255,20,0.4)', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '32px' }}>Field Identification</p>

        {sent ? (
          <p style={{ color: '#39FF14', fontSize: '14px', lineHeight: 1.6 }}>
            Lien envoyé — vérifie ta boîte mail et clique sur le lien pour te connecter.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              style={{ width: '100%', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.3)', color: '#E8E0D0', padding: '12px', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
            />
            {error && <p style={{ color: '#FF4444', fontSize: '12px', marginBottom: '8px' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', background: '#39FF14', color: '#050A05', fontWeight: 900, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.3em', padding: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? '...' : 'Se connecter'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
