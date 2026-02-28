import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import api from './lib/api';
import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// ─────────────────── Helpers ───────────────────
function openGmailCompose(subject: string, body: string, to = '') {
  const params = new URLSearchParams({ view: 'cm', fs: '1', su: subject, body, to }).toString();
  window.open(`https://mail.google.com/mail/?${params}`, '_blank');
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="avatar-dot">{name?.[0]?.toUpperCase() ?? '?'}</div>
  );
}

// ─────────────────── Navbar ───────────────────
function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const links = [
    { path: '/', label: 'Dashboard' },
    { path: '/matches', label: 'Matches' },
    { path: '/interview', label: 'Interview Prep' },
    { path: '/profile', label: 'Profile' },
  ];

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <span className="navbar-brand">⚡ InternMatch</span>
        <nav className="navbar-navlinks">
          {links.map((l) => (
            <button
              key={l.path}
              className={`nav-link ${location.pathname === l.path ? 'active' : ''}`}
              onClick={() => navigate(l.path)}
            >
              {l.label}
            </button>
          ))}
        </nav>
      </div>
      {user && (
        <div className="nav-right">
          <div className="user-pill">
            <Avatar name={user.name} />
            <span>{user.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}

// ─────────────────── Login / Register ───────────────────
function LoginPage() {
  const { user, login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', course: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(form);
      } else {
        await login(form.email, form.password);
      }
    } catch {
      setError('Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card fade-in">
        <div className="login-logo">⚡ InternMatch</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.75rem' }}>
          {isRegister
            ? 'Create your account and get AI-powered internship matches'
            : 'Welcome back — sign in to your account'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isRegister && (
            <>
              <div>
                <label className="field-label">Full name</label>
                <input
                  className="field-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Mwangi"
                  required
                />
              </div>
              <div>
                <label className="field-label">Course / field of study</label>
                <input
                  className="field-input"
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                  placeholder="Computer Science"
                  required
                />
              </div>
            </>
          )}
          <div>
            <label className="field-label">Email address</label>
            <input
              className="field-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@email.com"
              required
            />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input
              className="field-input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="alert alert-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.25rem' }}>
            {loading ? <><span className="spinner" /> Please wait…</> : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <hr className="divider" style={{ margin: '1.25rem 0' }} />
        <button
          type="button"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.82rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
        >
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────── Dashboard ───────────────────
type DashboardData = {
  applications: { total: number; byStatus: Record<string, number> };
  skills: { current: string[]; gaps: { skill: string; demand: number }[] };
};
type SkillGap = { skill: string; reason: string; priority: 'high' | 'medium' | 'low'; resource: string };
type MatchItem = {
  score: number;
  internship: {
    _id: string; title: string; company: string; location: string;
    isRemote: boolean; description: string; skillsRequired: string[]; applyUrl: string;
  };
};

// Helper — detect Kenyan / East African locations
const KENYA_KEYWORDS = ['kenya', 'nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret', 'thika', 'kikuyu', 'nyeri', 'east africa', 'africa'];
function isKenyanLocation(location: string): boolean {
  const l = location.toLowerCase();
  return KENYA_KEYWORDS.some((kw) => l.includes(kw));
}

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/match/recommendations')])
      .then(([d, m]) => { setDashboard(d.data); setMatches(m.data.slice(0, 5)); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const loadSkillGaps = async () => {
    setGapsLoading(true);
    try {
      const res = await api.get('/ai/skill-gaps');
      setSkillGaps(res.data.gaps ?? []);
    } catch {
      setSkillGaps([]);
    } finally {
      setGapsLoading(false);
    }
  };

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--muted)' }}>
      <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(108,99,255,0.2)', width: 18, height: 18 }} />
      Loading your dashboard…
    </div>
  );

  const statusData = dashboard
    ? Object.entries(dashboard.applications.byStatus).map(([status, value]) => ({ status, value }))
    : [];

  return (
    <div className="page fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="page-sub">Here's your internship tracking overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <span className="stat-label">Applications</span>
          <span className="stat-value" style={{ color: 'var(--accent)' }}>
            {dashboard?.applications.total ?? 0}
          </span>
          <span className="stat-sub">total submitted</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Your skills</span>
          <span className="stat-value" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
            {dashboard?.skills.current.length ?? 0}
          </span>
          <span className="stat-sub">
            {dashboard?.skills.current.slice(0, 3).join(', ') || 'Not set yet'}
          </span>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={loadSkillGaps}>
          <span className="stat-label">Skill Gaps (AI)</span>
          <span className="stat-value" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent2)' }}>
            {gapsLoading ? <span className="spinner" style={{ borderTopColor: 'var(--accent2)', borderColor: 'rgba(236,72,153,0.2)', width: 18, height: 18, display: 'inline-block' }} /> : skillGaps.length > 0 ? skillGaps.length : '—'}
          </span>
          <span className="stat-sub">
            {skillGaps.length > 0 ? skillGaps.slice(0, 2).map(g => g.skill).join(', ') : 'Click to analyse'}
          </span>
        </div>
      </div>

      <div className="grid-2">
        {/* Chart */}
        <div className="card">
          <p className="section-title">Application outcomes</p>
          {statusData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
              No applications tracked yet
              <br />
              <button className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => navigate('/matches')}>
                Browse internships →
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusData}>
                <XAxis dataKey="status" tick={{ fill: '#7a7f9a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#7a7f9a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#e8eaf2' }} />
                <Bar dataKey="value" fill="#6c63ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top matches */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p className="section-title" style={{ margin: 0 }}>Top matches for you</p>
            <button className="btn btn-ghost btn-xs" onClick={() => navigate('/matches')}>See all →</button>
          </div>
          {matches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--muted)', fontSize: '0.82rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/matches')}>
                Fetch internships to see matches
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '220px', overflowY: 'auto' }}>
              {matches.map((m) => (
                <div key={m.internship._id} className="card" style={{ padding: '0.75rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.15rem' }}>{m.internship.title}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{m.internship.company} · {m.internship.location}</p>
                    </div>
                    <span className="score-badge">{m.score}% match</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── AI Skill Gap Panel ── */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <div>
            <p className="section-title" style={{ margin: 0 }}>🎯 Skill Gap Analysis</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>Top skills you should learn for your career field — based on real internship listings</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadSkillGaps} disabled={gapsLoading}>
            {gapsLoading ? <><span className="spinner" /> Analysing…</> : skillGaps.length > 0 ? '↻ Refresh' : '✨ Analyse gaps'}
          </button>
        </div>

        {skillGaps.length === 0 && !gapsLoading && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted)', fontSize: '0.83rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧩</div>
            Click <strong>Analyse gaps</strong> to get a personalised list of skills to learn next,<br />
            based on what employers are actually asking for in your field.
          </div>
        )}

        {gapsLoading && (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted)', fontSize: '0.85rem', display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'center' }}>
            <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(108,99,255,0.2)', width: 18, height: 18 }} />
            AI is scanning internship listings and analysing your gaps…
          </div>
        )}

        {skillGaps.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
            {skillGaps.map((gap) => {
              const priorityColor = gap.priority === 'high' ? '#f87171' : gap.priority === 'medium' ? '#fbbf24' : '#34d399';
              const priorityBg = gap.priority === 'high' ? 'rgba(248,113,113,0.12)' : gap.priority === 'medium' ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.12)';
              return (
                <div key={gap.skill} style={{ background: priorityBg, border: `1px solid ${priorityColor}40`, borderRadius: 12, padding: '0.9rem 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{gap.skill}</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: priorityColor, background: `${priorityColor}20`, padding: '0.15rem 0.5rem', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{gap.priority}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.55, marginBottom: '0.5rem' }}>{gap.reason}</p>
                  {gap.resource && (
                    <a
                      href={gap.resource.startsWith('http') ? gap.resource : `https://www.google.com/search?q=learn+${encodeURIComponent(gap.skill)}`}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: '0.74rem', color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      📚 {gap.resource.startsWith('http') ? new URL(gap.resource).hostname.replace('www.', '') : gap.resource} →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────── Profile / Skills ───────────────────
function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ skills: string[]; preferredLocations: string[]; course: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const skillInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/profile').then((res) => {
      setProfile({ skills: res.data.skills || [], preferredLocations: res.data.preferredLocations || [], course: res.data.course || '' });
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/profile', profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || !profile || profile.skills.includes(s)) return;
    setProfile({ ...profile, skills: [...profile.skills, s] });
    setNewSkill('');
    skillInputRef.current?.focus();
  };

  const removeSkill = (sk: string) => {
    if (!profile) return;
    setProfile({ ...profile, skills: profile.skills.filter((x) => x !== sk) });
  };

  const addLoc = () => {
    const l = newLoc.trim();
    if (!l || !profile || profile.preferredLocations.includes(l)) return;
    setProfile({ ...profile, preferredLocations: [...profile.preferredLocations, l] });
    setNewLoc('');
  };

  const removeLoc = (loc: string) => {
    if (!profile) return;
    setProfile({ ...profile, preferredLocations: profile.preferredLocations.filter((x) => x !== loc) });
  };

  if (loading) return (
    <div className="page" style={{ color: 'var(--muted)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(108,99,255,0.2)', width: 18, height: 18 }} />
      Loading profile…
    </div>
  );

  return (
    <div className="page-sm fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="page-title">Your Profile</h1>
        <p className="page-sub">Manage your skills and preferences to get better matches</p>
      </div>

      {/* Identity */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 999,
            background: 'linear-gradient(135deg,#6c63ff,#48cfad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', fontWeight: 700, color: '#fff'
          }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{user?.name}</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{user?.email}</p>
          </div>
        </div>
        <hr className="divider" />
        <div>
          <label className="field-label">Course / Field of study</label>
          <input
            className="field-input"
            value={profile?.course ?? ''}
            onChange={(e) => profile && setProfile({ ...profile, course: e.target.value })}
            placeholder="e.g. Computer Science"
          />
        </div>
      </div>

      {/* Skills */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <p className="section-title">Skills</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
          {(profile?.skills ?? []).length === 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>No skills added yet</span>
          )}
          {(profile?.skills ?? []).map((sk) => (
            <span key={sk} className="tag">
              {sk}
              <button className="tag-remove" onClick={() => removeSkill(sk)} title="Remove">×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            ref={skillInputRef}
            className="field-input"
            placeholder="e.g. React, Python, Figma…"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary btn-sm" onClick={addSkill}>+ Add</button>
        </div>
      </div>

      {/* Preferred locations */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <p className="section-title">Preferred Locations</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
          {(profile?.preferredLocations ?? []).length === 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>No preferred locations set</span>
          )}
          {(profile?.preferredLocations ?? []).map((loc) => (
            <span key={loc} className="tag tag-green">
              {loc}
              <button className="tag-remove" onClick={() => removeLoc(loc)} title="Remove">×</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className="field-input"
            placeholder="e.g. Remote, Nairobi, London…"
            value={newLoc}
            onChange={(e) => setNewLoc(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLoc(); } }}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary btn-sm" onClick={addLoc}>+ Add</button>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <><span className="spinner" /> Saving…</> : 'Save profile'}
        </button>
        {saved && <span className="alert alert-success" style={{ padding: '0.45rem 0.9rem' }}>✓ Profile saved!</span>}
      </div>
    </div>
  );
}

// ─────────────────── Matches ───────────────────
function MatchesPage() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumeText, setResumeText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [mode, setMode] = useState<'cv' | 'email'>('cv');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [locationFilter, setLocationFilter] = useState<'all' | 'kenya' | 'remote'>('all');

  const filteredMatches = matches.filter((m) => {
    if (locationFilter === 'kenya') return isKenyanLocation(m.internship.location);
    if (locationFilter === 'remote') return m.internship.isRemote;
    return true;
  });

  const selectedMatch = matches.find((m) => m.internship._id === selectedId);

  const load = () => api.get('/match/recommendations')
    .then((res) => setMatches(res.data))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const syncInternships = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.post('/internships/sync');
      const { inserted, updated, message } = res.data;
      setSyncMsg({ text: `${message} (${inserted} new, ${updated} updated)`, type: 'success' });
      await api.get('/match/recommendations').then((r) => setMatches(r.data));
    } catch (err: any) {
      const detail = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
      setSyncMsg({ text: `Sync failed: ${detail}`, type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const runAi = async () => {
    if (!selectedId) return;
    setAiResponse('');
    setAiRunning(true);
    try {
      if (mode === 'cv') {
        const res = await api.post('/ai/cv-improvements', { internshipId: selectedId, resumeText });
        setAiResponse(res.data.text);
      } else {
        const res = await api.post('/ai/application-email', { internshipId: selectedId });
        setAiResponse(res.data.text);
      }
    } catch {
      setAiResponse('AI request failed. Please try again.');
    } finally {
      setAiRunning(false);
    }
  };

  const handleGmail = () => {
    if (!aiResponse || !selectedMatch) return;
    const subject = `Application for ${selectedMatch.internship.title} at ${selectedMatch.internship.company}`;
    // Try to guess a recruiter email from applyUrl domain
    const domain = (() => { try { return new URL(selectedMatch.internship.applyUrl).hostname.replace('www.', ''); } catch { return ''; } })();
    const to = domain ? `careers@${domain}` : '';
    openGmailCompose(subject, aiResponse, to);
  };

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Internship Matches</h1>
          <p className="page-sub">AI-scored matches based on your profile and skills</p>
        </div>
        <button className="btn btn-secondary" onClick={syncInternships} disabled={syncing}>
          {syncing ? <><span className="spinner" /> Fetching…</> : '⟳ Refresh internships'}
        </button>
      </div>

      {syncMsg && (
        <div className={`alert ${syncMsg.type === 'error' ? 'alert-error' : syncMsg.type === 'info' ? 'alert-info' : 'alert-success'}`} style={{ marginBottom: '1rem' }}>
          {syncMsg.text}
        </div>
      )}

      {/* Location filter tabs */}
      <div className="tab-group" style={{ marginBottom: '1.25rem', width: 'fit-content' }}>
        {(['all', 'kenya', 'remote'] as const).map((f) => (
          <button
            key={f}
            className={`tab-btn ${locationFilter === f ? 'active' : ''}`}
            onClick={() => setLocationFilter(f)}
          >
            {f === 'kenya' ? '🇰🇪 Kenya' : f === 'remote' ? '🌐 Remote' : '🌍 All'}
          </button>
        ))}
      </div>

      <div className="grid-aside">
        {/* Left: internship list */}
        <div>
          <p className="section-title">
            {filteredMatches.length}{filteredMatches.length !== matches.length ? ` / ${matches.length}` : ''} internships found
          </p>
          {loading ? (
            <div style={{ color: 'var(--muted)', display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.875rem' }}>
              <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(108,99,255,0.2)', width: 16, height: 16 }} />
              Loading matches…
            </div>
          ) : filteredMatches.length === 0 && locationFilter !== 'all' ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                {locationFilter === 'kenya' ? '🇰🇪' : '🌐'}
              </div>
              <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>
                No {locationFilter === 'kenya' ? 'Kenyan' : 'remote'} internships in current results
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                Try refreshing to fetch more, or switch to All view.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => setLocationFilter('all')}>Show all →</button>
            </div>
          ) : matches.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No internships yet</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
                Fetch internships from external sources to see your personalised matches
              </p>
              <button className="btn btn-primary" onClick={syncInternships} disabled={syncing}>
                {syncing ? <><span className="spinner" /> Fetching…</> : '⟳ Fetch internships now'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredMatches.map((m) => (
                <button
                  key={m.internship._id}
                  className={`intern-card ${selectedId === m.internship._id ? 'selected' : ''}`}
                  onClick={() => { setSelectedId(m.internship._id); setAiResponse(''); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{m.internship.title}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
                        {m.internship.company} · {m.internship.location}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
                        {m.internship.isRemote && <span className="pill pill-remote">Remote</span>}
                        {isKenyanLocation(m.internship.location) && (
                          <span className="pill" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', fontWeight: 600 }}>🇰🇪 Kenya</span>
                        )}
                        {m.internship.skillsRequired.slice(0, 3).map((sk) => (
                          <span key={sk} className="pill" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{sk}</span>
                        ))}
                      </div>
                      <p className="truncate-2" style={{ fontSize: '0.77rem', color: 'var(--muted)' }}>{m.internship.description}</p>
                    </div>
                    <span className="score-badge">{m.score}%</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: AI assistant panel */}
        <div>
          <div className="card" style={{ position: 'sticky', top: '76px' }}>
            <p className="section-title">AI Assistant</p>

            {!selectedId ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--muted)', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
                Select an internship on the left to get AI assistance
              </div>
            ) : (
              <>
                <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 10, padding: '0.65rem 0.85rem', marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.1rem' }}>{selectedMatch?.internship.title}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{selectedMatch?.internship.company}</p>
                </div>

                {/* Mode tabs */}
                <div className="tab-group" style={{ marginBottom: '0.85rem' }}>
                  <button className={`tab-btn ${mode === 'cv' ? 'active' : ''}`} onClick={() => { setMode('cv'); setAiResponse(''); }}>📄 CV Tips</button>
                  <button className={`tab-btn ${mode === 'email' ? 'active' : ''}`} onClick={() => { setMode('email'); setAiResponse(''); }}>✉️ Email Draft</button>
                </div>

                {mode === 'cv' && (
                  <div style={{ marginBottom: '0.85rem' }}>
                    <label className="field-label">Paste your CV (optional, improves suggestions)</label>
                    <textarea
                      className="field-input field-textarea"
                      style={{ minHeight: 90 }}
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste key bullet points or full CV text…"
                    />
                  </div>
                )}

                <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.85rem' }} onClick={runAi} disabled={aiRunning}>
                  {aiRunning ? <><span className="spinner" /> Thinking…</> : mode === 'cv' ? '✨ Get CV improvements' : '✨ Generate email draft'}
                </button>

                {/* AI Response box */}
                <div style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.85rem',
                  minHeight: 120,
                  maxHeight: 280,
                  overflowY: 'auto',
                  fontSize: '0.8rem',
                  lineHeight: 1.65,
                  color: aiResponse ? 'var(--text)' : 'var(--muted)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {aiRunning
                    ? <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--muted)' }}><span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(108,99,255,0.2)', width: 14, height: 14 }} /> AI is thinking…</div>
                    : aiResponse || 'AI output will appear here…'}
                </div>

                {/* Gmail button */}
                {aiResponse && mode === 'email' && (
                  <button
                    className="btn btn-success"
                    style={{ width: '100%', marginTop: '0.75rem' }}
                    onClick={handleGmail}
                  >
                    📧 Open in Gmail — just press Send!
                  </button>
                )}

                {aiResponse && (
                  <a
                    href={selectedMatch?.internship.applyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                    style={{ width: '100%', marginTop: '0.5rem', display: 'flex', textDecoration: 'none' }}
                  >
                    🔗 View original job posting
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Interview Prep ───────────────────
function InterviewPage() {
  const [internships, setInternships] = useState<MatchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    api.get('/match/recommendations').then((res) => setInternships(res.data));
  }, []);

  const selectedInternship = internships.find((m) => m.internship._id === selectedId);

  const generateQuestions = async () => {
    if (!selectedId) return;
    setGenLoading(true);
    setQuestions('');
    try {
      const res = await api.post('/ai/interview-questions', { internshipId: selectedId, count: 8 });
      setQuestions(res.data.text);
    } catch {
      setQuestions('Failed to generate questions. Please try again.');
    } finally {
      setGenLoading(false);
    }
  };

  const review = async () => {
    if (!selectedId || !question || !answer) return;
    setReviewLoading(true);
    setFeedback('');
    try {
      const res = await api.post('/ai/interview-review', { internshipId: selectedId, question, answer });
      setFeedback(res.data.text);
    } catch {
      setFeedback('Failed to review answer. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="page fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">Interview Prep</h1>
        <p className="page-sub">AI-generated mock questions and answer coaching for your target roles</p>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        {/* Left: pick internship + generate questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <p className="section-title">Select a role</p>
            {internships.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.85rem' }}>
                  Fetch internships first to see roles here
                </p>
                <button className="btn btn-primary btn-sm" disabled={syncing} onClick={async () => {
                  setSyncing(true);
                  try {
                    await api.post('/internships/sync');
                    const res = await api.get('/match/recommendations');
                    setInternships(res.data);
                  } finally { setSyncing(false); }
                }}>
                  {syncing ? <><span className="spinner" /> Fetching…</> : '⟳ Fetch internships'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 280, overflowY: 'auto' }}>
                {internships.map((m) => (
                  <button
                    key={m.internship._id}
                    className={`intern-card ${selectedId === m.internship._id ? 'selected' : ''}`}
                    style={{ padding: '0.6rem 0.85rem', borderRadius: 10 }}
                    onClick={() => { setSelectedId(m.internship._id); setQuestions(''); setFeedback(''); }}
                  >
                    <p style={{ fontWeight: 600, fontSize: '0.82rem' }}>{m.internship.title}</p>
                    <p style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{m.internship.company}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <p className="section-title">Mock interview questions</p>
            {selectedInternship && (
              <div style={{ marginBottom: '0.75rem', background: 'rgba(108,99,255,0.08)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>{selectedInternship.internship.title}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{selectedInternship.internship.company}</p>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.85rem' }} disabled={!selectedId || genLoading} onClick={generateQuestions}>
              {genLoading ? <><span className="spinner" /> Generating…</> : '🎯 Generate 8 questions'}
            </button>
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '0.85rem',
              minHeight: 120,
              maxHeight: 240,
              overflowY: 'auto',
              fontSize: '0.79rem',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              color: questions ? 'var(--text)' : 'var(--muted)',
            }}>
              {genLoading
                ? <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--muted)' }}><span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(108,99,255,0.2)', width: 14, height: 14 }} /> Generating questions…</div>
                : questions || 'Questions will appear here after you click generate'}
            </div>
          </div>
        </div>

        {/* Right: practice answer */}
        <div className="card">
          <p className="section-title">Practice your answer</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label className="field-label">Paste a question to practice</label>
              <textarea
                className="field-input field-textarea"
                placeholder="e.g. Tell me about a challenging project you worked on…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                style={{ minHeight: 72 }}
              />
            </div>
            <div>
              <label className="field-label">Your answer (aim for 1–3 minutes of speech)</label>
              <textarea
                className="field-input field-textarea"
                placeholder="Type your full answer here…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                style={{ minHeight: 110 }}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={review} disabled={!question || !answer || reviewLoading}>
              {reviewLoading ? <><span className="spinner" /> Evaluating…</> : '🧠 Get AI feedback'}
            </button>
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '0.85rem',
              minHeight: 130,
              maxHeight: 260,
              overflowY: 'auto',
              fontSize: '0.8rem',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              color: feedback ? 'var(--text)' : 'var(--muted)',
            }}>
              {reviewLoading
                ? <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--muted)' }}><span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(108,99,255,0.2)', width: 14, height: 14 }} /> Evaluating your answer…</div>
                : feedback || 'AI feedback will appear here after submitting your answer'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Protected Routes ───────────────────
function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: '0.75rem' }}>
      <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(108,99,255,0.2)', width: 20, height: 20 }} />
      Loading…
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

// ─────────────────── Root ───────────────────
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}
