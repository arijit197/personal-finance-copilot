import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = 'http://127.0.0.1:8000'

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const raw = await res.text()

  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    const detail = data?.detail
    const detailText =
      typeof detail === 'string'
        ? detail
        : detail?.message || JSON.stringify(detail || data || raw)
    const err = new Error(`Request failed: ${res.status} ${detailText}`)
    err.responseData = data
    throw err
  }

  return data
}

function AuthCard({ mode, onModeChange, onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isRegister = mode === 'register'

  async function registerThenLogin() {
    await fetchJson(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
      }),
    })
  }

  async function login() {
    const formData = new URLSearchParams()
    formData.set('username', email)
    formData.set('password', password)

    return fetchJson(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isRegister) {
        await registerThenLogin()
      }
      const loginResponse = await login()
      onLoginSuccess(loginResponse.access_token, loginResponse.user)
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card auth-card">
      <h2>{isRegister ? 'Create Account' : 'Login'}</h2>
      <form onSubmit={submit}>
        {isRegister && (
          <label>
            Full Name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? 'Register & Login' : 'Login'}
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
      <p className="muted">
        {isRegister ? 'Already have account?' : 'New here?'}{' '}
        <button className="link-btn" onClick={() => onModeChange(isRegister ? 'login' : 'register')}>
          {isRegister ? 'Login' : 'Register'}
        </button>
      </p>
    </div>
  )
}

function ForecastCard({ forecast }) {
  if (!forecast) return null

  if (!forecast.ok) {
    return <div className="card error">Forecast unavailable: {forecast.error}</div>
  }

  return (
    <div className="card">
      <h3>Next Month Forecast</h3>
      <p><strong>Based on:</strong> {forecast.last_month}</p>
      <p>Predicted Income: ₹{forecast.predicted_next_month_income?.toLocaleString()}</p>
      <p>Predicted Expense: ₹{forecast.predicted_next_month_expense?.toLocaleString()}</p>
      <p>Predicted Savings: ₹{forecast.predicted_next_month_savings?.toLocaleString()}</p>
    </div>
  )
}

function SavingsPlanCard({ plan }) {
  if (!plan) return null

  if (!plan.ok) {
    return <div className="card error">Savings plan unavailable: {plan.error}</div>
  }

  return (
    <div className="card">
      <h3>Savings Target Plan</h3>
      <p>Target Savings: ₹{plan.target_savings?.toLocaleString()}</p>
      <p>Current Savings: ₹{plan.current_savings?.toLocaleString()}</p>
      <p><strong>Cut Needed:</strong> ₹{plan.cut_needed?.toLocaleString()}</p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Current</th>
              <th>Suggested Cut</th>
              <th>New Budget</th>
            </tr>
          </thead>
          <tbody>
            {plan.suggested_category_plan?.map((row) => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td>₹{row.current_amount.toLocaleString()}</td>
                <td>₹{row.suggested_cut.toLocaleString()}</td>
                <td>₹{row.suggested_new_budget.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AiAnswerCard({ response }) {
  if (!response) return null

  if (!response.ok) {
    return <div className="card error">AI response unavailable: {response.error || 'Unknown error'}</div>
  }

  return (
    <div className="card">
      <h3>AI Insight</h3>
      <pre>{response.advice}</pre>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')

  const [question, setQuestion] = useState('How can I save more next month?')
  const [incomeGrowth, setIncomeGrowth] = useState(5)
  const [targetSavings, setTargetSavings] = useState(55000)
  const [model, setModel] = useState('llama3.2:3b')

  const [csvFile, setCsvFile] = useState(null)
  const [statementText, setStatementText] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadTips, setUploadTips] = useState([])
  const [uploadPreviewLines, setUploadPreviewLines] = useState([])

  const [forecast, setForecast] = useState(null)
  const [plan, setPlan] = useState(null)
  const [aiResponse, setAiResponse] = useState(null)
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])

  const canSubmit = useMemo(() => question.trim().length > 0, [question])

  function logout() {
    setToken('')
    setUser(null)
    setForecast(null)
    setPlan(null)
    setAiResponse(null)
    setSummary(null)
    setTransactions([])
    setUploadMessage('')
  }

  function onLoginSuccess(nextToken, nextUser) {
    setToken(nextToken)
    setUser(nextUser)
  }

  async function apiGet(path) {
    return fetchJson(`${API_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async function apiWithAuth(path, options = {}) {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    }
    return fetchJson(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
  }

  async function loadUserData() {
    if (!token) return
    try {
      const [settings, tx, sum] = await Promise.all([
        apiGet('/user/settings'),
        apiGet('/user/transactions?limit=200'),
        apiGet('/user/summary').catch(() => null),
      ])
      setIncomeGrowth(settings.default_income_growth_pct ?? 5)
      setTargetSavings(settings.default_target_savings ?? 55000)
      setModel(settings.ollama_model || 'llama3.2:3b')
      setTransactions(tx.items || [])
      setSummary(sum)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function runCopilot() {
    if (!canSubmit || !token) return
    setLoading(true)
    setError('')

    try {
      const [forecastData, planData, aiData] = await Promise.all([
        apiGet(`/user/forecast?income_growth_pct=${encodeURIComponent(incomeGrowth)}`),
        apiGet(`/user/savings-plan?target_savings=${encodeURIComponent(targetSavings)}`),
        apiGet(`/user/ai-ask?question=${encodeURIComponent(question)}&model=${encodeURIComponent(model)}`),
      ])

      setForecast(forecastData)
      setPlan(planData)
      setAiResponse(aiData)
    } catch (err) {
      setError(err.message || 'Something went wrong while fetching insights.')
    } finally {
      setLoading(false)
    }
  }

  async function uploadCsv() {
    if (!csvFile) return
    const formData = new FormData()
    formData.append('file', csvFile)

    setUploadMessage('Uploading CSV...')
    setUploadTips([])
    setUploadPreviewLines([])
    try {
      const resp = await apiWithAuth('/user/upload-csv', {
        method: 'POST',
        body: formData,
      })
      setUploadMessage(`CSV uploaded. Inserted ${resp.inserted} transactions.`)
      setCsvFile(null)
      await loadUserData()
    } catch (err) {
      setUploadMessage(`CSV upload failed: ${err.message}`)
    }
  }

  async function uploadStatementText() {
    const cleanText = statementText.trim()
    if (!cleanText) return

    setUploadMessage('Processing statement text...')
    setUploadTips([])
    setUploadPreviewLines([])
    try {
      const resp = await apiWithAuth('/user/upload-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      })
      setUploadMessage(`Text upload complete. Inserted ${resp.inserted} transactions.`)
      setUploadPreviewLines(resp.text_preview_lines || [])
      setStatementText('')
      await loadUserData()
    } catch (err) {
      const detail = err?.responseData?.detail
      const tips = Array.isArray(detail?.tips) ? detail.tips : []
      const preview = Array.isArray(detail?.text_preview_lines) ? detail.text_preview_lines : []
      setUploadTips(tips)
      setUploadPreviewLines(preview)
      setUploadMessage(`Text upload failed: ${detail?.message || err.message}`)
    }
  }

  async function saveSettings() {
    try {
      await apiWithAuth('/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_income_growth_pct: Number(incomeGrowth),
          default_target_savings: Number(targetSavings),
          ollama_model: model,
        }),
      })
      setUploadMessage('Settings saved.')
    } catch (err) {
      setUploadMessage(`Failed to save settings: ${err.message}`)
    }
  }

  async function clearHistory() {
    try {
      await apiWithAuth('/user/transactions', { method: 'DELETE' })
      setTransactions([])
      setSummary(null)
      setUploadMessage('Transaction history cleared.')
    } catch (err) {
      setUploadMessage(`Failed to clear history: ${err.message}`)
    }
  }

  async function downloadWithAuth(path, filename) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status}`)
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-hero">
          <h1>Personal Finance Copilot</h1>
          <p>Secure dashboard for your transactions, insights, forecasting, and savings planning.</p>
        </div>
        <AuthCard
          mode={authMode}
          onModeChange={setAuthMode}
          onLoginSuccess={onLoginSuccess}
        />
      </div>
    )
  }

  return (
    <div>
      <nav className="top-nav">
        <div className="brand">Finance Copilot</div>
        <div className="nav-links">
          <a href="#upload">Data</a>
          <a href="#settings">Settings</a>
          <a href="#insights">Insights</a>
          <a href="#history">History</a>
        </div>
        <div className="nav-user">
          <span>{user?.full_name || user?.email}</span>
          <button className="secondary-btn" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page">
        <div className="welcome-row card">
          <h1>Dashboard</h1>
          <p>Upload your latest statement and generate AI-driven finance actions in seconds.</p>
        </div>

        {summary && (
          <div className="metrics-grid">
            <div className="metric-card">
              <span>Total In</span>
              <strong>₹{summary.total_in?.toLocaleString()}</strong>
            </div>
            <div className="metric-card">
              <span>Total Out</span>
              <strong>₹{summary.total_out?.toLocaleString()}</strong>
            </div>
            <div className="metric-card">
              <span>Net Savings</span>
              <strong>₹{summary.net_savings?.toLocaleString()}</strong>
            </div>
          </div>
        )}

      <div id="upload" className="card">
        <h3>Upload Data</h3>
        <div className="row">
          <label>
            Upload Bank CSV
            <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
            <button onClick={uploadCsv} disabled={!csvFile}>Upload CSV</button>
          </label>

          <label>
            Paste Statement Text
            <textarea
              rows={6}
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              placeholder="Paste transaction lines here. Example: 01/02/2026 UPI SWIGGY DR 450.00 12500.00"
            />
            <button onClick={uploadStatementText} disabled={!statementText.trim()}>Upload Text</button>
          </label>
        </div>
        {uploadMessage && <p className="muted">{uploadMessage}</p>}
        {uploadTips.length > 0 && (
          <div className="error-note">
            <strong>Parsing Tips:</strong>
            <ul>
              {uploadTips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
        {uploadPreviewLines.length > 0 && (
          <details className="ocr-preview">
            <summary>Text preview</summary>
            <pre>{uploadPreviewLines.join('\n')}</pre>
          </details>
        )}
      </div>

      <div id="settings" className="card">
        <h3>Settings</h3>
        <div className="row">
          <label>
            Income Growth %
            <input type="number" value={incomeGrowth} onChange={(e) => setIncomeGrowth(e.target.value)} />
          </label>
          <label>
            Target Savings (₹)
            <input type="number" value={targetSavings} onChange={(e) => setTargetSavings(e.target.value)} />
          </label>
        </div>
        <label>
          Ollama Model
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </label>
        <div className="button-row">
          <button onClick={saveSettings}>Save Settings</button>
          <button
            className="secondary-btn"
            onClick={() => downloadWithAuth('/user/reports/transactions.csv', 'transactions_report.csv')}
          >
            Download CSV Report
          </button>
          <button
            className="secondary-btn"
            onClick={() => downloadWithAuth('/user/reports/summary.pdf', 'finance_summary_report.pdf')}
          >
            Download PDF Report
          </button>
          <button className="danger-btn" onClick={clearHistory}>Clear History</button>
        </div>
      </div>

      <div id="insights" className="card form-card">
        <label>
          Ask AI a finance question
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Example: Where am I overspending and what should I cut next month?"
          />
        </label>

        <div className="row">
          <label>
            Income Growth %
            <input
              type="number"
              value={incomeGrowth}
              onChange={(e) => setIncomeGrowth(e.target.value)}
            />
          </label>

          <label>
            Target Savings (₹)
            <input
              type="number"
              value={targetSavings}
              onChange={(e) => setTargetSavings(e.target.value)}
            />
          </label>
        </div>

        <button disabled={loading || !canSubmit} onClick={runCopilot}>
          {loading ? 'Loading insights...' : 'Get Insights'}
        </button>

        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="grid">
        <ForecastCard forecast={forecast} />
        <SavingsPlanCard plan={plan} />
      </div>

      <AiAnswerCard response={aiResponse} />

      <div id="history" className="card">
        <h3>User History (Latest 200)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.description}</td>
                  <td>₹{Number(t.debit || 0).toLocaleString()}</td>
                  <td>₹{Number(t.credit || 0).toLocaleString()}</td>
                  <td>{t.source_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  )
}
