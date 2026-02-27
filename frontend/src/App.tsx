import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card } from './components/ui/card';
import api from './lib/api';
import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function AuthLayout() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b bg-white">
      <div className="container flex items-center justify-between py-3">
        <span className="font-semibold text-lg">Internship Match Engine</span>
        <div className="flex items-center gap-3 text-sm">
          {user && <span>{user.name}</span>}
          <Button variant="outline" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}

function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', course: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    } catch (err) {
      setError('Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold mb-2">
          {isRegister ? 'Create your student account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          {isRegister
            ? 'Get personalized internship matches and AI-powered guidance.'
            : 'Sign in to see your matches and applications.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <>
              <div>
                <label className="text-sm mb-1 block">Full name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm mb-1 block">Course</label>
                <Input
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value })}
                  required
                />
              </div>
            </>
          )}
          <div>
            <label className="text-sm mb-1 block">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-sm mb-1 block">Password</label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <button
          type="button"
          className="mt-3 text-xs text-blue-600 underline"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? 'Already have an account? Sign in' : "New here? Create a student's account"}
        </button>
      </Card>
    </div>
  );
}

type DashboardData = {
  applications: {
    total: number;
    byStatus: Record<string, number>;
  };
  skills: {
    current: string[];
    gaps: { skill: string; demand: number }[];
  };
};

type MatchItem = {
  score: number;
  internship: {
    _id: string;
    title: string;
    company: string;
    location: string;
    isRemote: boolean;
    description: string;
    skillsRequired: string[];
    applyUrl: string;
  };
};

function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [d, m] = await Promise.all([api.get('/dashboard'), api.get('/match/recommendations')]);
      setDashboard(d.data);
      setMatches(m.data.slice(0, 5));
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-4">Loading dashboard…</p>;
  }

  if (!dashboard) {
    return <p className="p-4">No data yet. Start applying to internships!</p>;
  }

  const statusData = Object.entries(dashboard.applications.byStatus).map(([status, value]) => ({
    status,
    value,
  }));

  return (
    <div className="container py-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Total applications</p>
          <p className="text-2xl font-semibold">{dashboard.applications.total}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Current skills</p>
          <p className="text-sm">{dashboard.skills.current.join(', ') || 'Not set yet'}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Top skill gaps</p>
          <p className="text-sm">
            {dashboard.skills.gaps.slice(0, 3).map((g) => g.skill).join(', ') || 'None detected'}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold mb-2 text-sm">Application outcomes</h2>
          {statusData.length === 0 ? (
            <p className="text-xs text-gray-500">No applications yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData}>
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold mb-2 text-sm">Top recommended internships</h2>
          <div className="space-y-2 max-h-56 overflow-auto">
            {matches.map((m) => (
              <div key={m.internship._id} className="border rounded-md p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{m.internship.title}</p>
                    <p className="text-xs text-gray-500">
                      {m.internship.company} · {m.internship.location}{' '}
                      {m.internship.isRemote && '· Remote'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600">{m.score}% match</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MatchesPage() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumeText, setResumeText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [mode, setMode] = useState<'cv' | 'email'>('cv');

  useEffect(() => {
    api
      .get('/match/recommendations')
      .then((res) => setMatches(res.data))
      .finally(() => setLoading(false));
  }, []);

  const runAi = async () => {
    if (!selectedId) return;
    setAiResponse('Thinking with AI…');
    try {
      if (mode === 'cv') {
        const res = await api.post('/ai/cv-improvements', {
          internshipId: selectedId,
          resumeText,
        });
        setAiResponse(res.data.text);
      } else {
        const res = await api.post('/ai/application-email', { internshipId: selectedId });
        setAiResponse(res.data.text);
      }
    } catch {
      setAiResponse('AI request failed. Please try again.');
    }
  };

  return (
    <div className="container py-6 grid gap-4 md:grid-cols-[2fr,1.5fr]">
      <div className="space-y-3">
        <h2 className="font-semibold text-sm mb-1">Internship matches</h2>
        {loading ? (
          <p>Loading matches…</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <button
                key={m.internship._id}
                type="button"
                onClick={() => setSelectedId(m.internship._id)}
                className={`w-full text-left border rounded-md p-3 hover:border-blue-500 ${
                  selectedId === m.internship._id ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{m.internship.title}</p>
                    <p className="text-xs text-gray-500 mb-1">
                      {m.internship.company} · {m.internship.location}{' '}
                      {m.internship.isRemote && '· Remote'}
                    </p>
                    <p className="text-xs line-clamp-2">{m.internship.description}</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Skills: {m.internship.skillsRequired.join(', ')}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                    {m.score}% match
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">AI application assistant</h2>
          <div className="flex gap-1 text-xs">
            <Button
              type="button"
              variant={mode === 'cv' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('cv')}
            >
              CV tips
            </Button>
            <Button
              type="button"
              variant={mode === 'email' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('email')}
            >
              Email draft
            </Button>
          </div>
        </div>
        {mode === 'cv' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-500">
              Paste your current CV or key bullet points (optional but improves suggestions)
            </label>
            <textarea
              className="w-full h-28 border rounded-md p-2 text-xs"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
          </div>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={!selectedId}
          onClick={runAi}
        >
          {mode === 'cv' ? 'Get tailored CV improvements' : 'Generate application email'}
        </Button>
        <div className="border rounded-md p-2 h-40 overflow-auto text-xs whitespace-pre-wrap bg-slate-50">
          {aiResponse || 'Select a match and run the AI assistant to see suggestions here.'}
        </div>
      </Card>
    </div>
  );
}

function InterviewPage() {
  const [internships, setInternships] = useState<MatchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    api.get('/match/recommendations').then((res) => setInternships(res.data));
  }, []);

  const generateQuestions = async () => {
    if (!selectedId) return;
    setQuestions('Generating questions…');
    const res = await api.post('/ai/interview-questions', { internshipId: selectedId, count: 8 });
    setQuestions(res.data.text);
  };

  const review = async () => {
    if (!selectedId || !question || !answer) return;
    setFeedback('Evaluating answer…');
    const res = await api.post('/ai/interview-review', {
      internshipId: selectedId,
      question,
      answer,
    });
    setFeedback(res.data.text);
  };

  return (
    <div className="container py-6 grid gap-4 md:grid-cols-[1.4fr,1.6fr]">
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">Choose internship for mock interview</h2>
        <div className="space-y-2">
          {internships.map((m) => (
            <button
              key={m.internship._id}
              type="button"
              onClick={() => setSelectedId(m.internship._id)}
              className={`w-full text-left border rounded-md p-2 text-xs hover:border-blue-500 ${
                selectedId === m.internship._id ? 'border-blue-500 bg-blue-50' : ''
              }`}
            >
              {m.internship.title} · {m.internship.company}
            </button>
          ))}
        </div>
        <Button type="button" className="w-full" disabled={!selectedId} onClick={generateQuestions}>
          Generate mock interview questions
        </Button>
        <div className="border rounded-md p-2 h-48 bg-slate-50 overflow-auto text-xs whitespace-pre-wrap">
          {questions || 'Your generated interview questions will appear here.'}
        </div>
      </div>
      <Card className="space-y-2">
        <h2 className="font-semibold text-sm">Practice an answer</h2>
        <label className="text-xs text-gray-500">Paste one question you want to practice</label>
        <textarea
          className="w-full border rounded-md p-2 text-xs"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <label className="text-xs text-gray-500">Type your answer (1–3 minutes speaking time)</label>
        <textarea
          className="w-full h-24 border rounded-md p-2 text-xs"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <Button type="button" className="w-full" onClick={review} disabled={!question || !answer}>
          Get AI feedback
        </Button>
        <div className="border rounded-md p-2 h-40 bg-slate-50 overflow-auto text-xs whitespace-pre-wrap">
          {feedback || 'AI feedback and improved answer will appear here.'}
        </div>
      </Card>
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-4">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <AuthLayout />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

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

