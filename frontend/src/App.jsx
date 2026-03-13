import { useEffect, useMemo, useState } from 'react'

const API_BASE_URL = 'http://127.0.0.1:8000'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const CATEGORY_RULES = {
  Food: ['swiggy', 'restaurant', 'coffee', 'grocery', 'bigbasket'],
  Transport: ['uber', 'fuel', 'metro', 'bus', 'taxi'],
  Utilities: ['electricity', 'internet', 'mobile', 'bill', 'recharge'],
  Shopping: ['amazon', 'shopping', 'flipkart'],
  Entertainment: ['movie', 'bookmyshow', 'netflix', 'spotify'],
  Housing: ['rent'],
  Investment: ['sip', 'mutual fund', 'investment'],
  Health: ['pharmacy', 'medical', 'hospital'],
  Cash: ['atm', 'cash withdrawal'],
}

const formatINR = (value) => `₹${Number(value || 0).toLocaleString()}`

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

function mapAuthError(err) {
  const msg = String(err?.message || '')
  const detail = String(err?.responseData?.detail || '').toLowerCase()
  if (msg.includes('401') || detail.includes('invalid email or password') || detail.includes('invalid')) {
    return 'Wrong email or password. Please check and try again.'
  }
  if (msg.includes('400') && detail.includes('already registered')) {
    return 'This email is already registered. Please login instead.'
  }
  if (msg.includes('404')) {
    return 'Service temporarily unavailable. Please try again in a moment.'
  }
  return 'Unable to complete authentication right now. Please try again.'
}

function parseDateText(dateText) {
  if (!dateText) return null
  const clean = String(dateText).trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const d = new Date(clean)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const parts = clean.split(/[/-]/)
  if (parts.length === 3) {
    const [p1, p2, p3] = parts
    if (p1.length <= 2) {
      const day = Number(p1)
      const month = Number(p2)
      const year = Number(p3.length === 2 ? `20${p3}` : p3)
      const d = new Date(year, month - 1, day)
      return Number.isNaN(d.getTime()) ? null : d
    }
  }

  const fallback = new Date(clean)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function toMonthKey(dateText) {
  const d = parseDateText(dateText)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function categorize(description) {
  const text = String(description || '').toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    if (keywords.some((k) => text.includes(k))) return category
  }
  return 'Other'
}

function computeSummary(items) {
  const totalIn = items.reduce((sum, t) => sum + Number(t.credit || 0), 0)
  const totalOut = items.reduce((sum, t) => sum + Number(t.debit || 0), 0)
  return {
    total_in: totalIn,
    total_out: totalOut,
    net_savings: totalIn - totalOut,
  }
}

function computeCategoryBreakdown(items) {
  const map = new Map()
  for (const t of items) {
    const debit = Number(t.debit || 0)
    if (debit <= 0) continue
    const c = categorize(t.description)
    map.set(c, (map.get(c) || 0) + debit)
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

function computeTopExpenses(items, limit = 8) {
  return items
    .filter((t) => Number(t.debit || 0) > 0)
    .sort((a, b) => Number(b.debit || 0) - Number(a.debit || 0))
    .slice(0, limit)
    .map((t) => ({
      date: t.date,
      description: t.description,
      amount: Number(t.debit || 0),
    }))
}

function computeMonthlySummary(items) {
  const map = new Map()
  for (const t of items) {
    const m = toMonthKey(t.date)
    if (!m) continue
    const row = map.get(m) || { month: m, total_in: 0, total_out: 0 }
    row.total_in += Number(t.credit || 0)
    row.total_out += Number(t.debit || 0)
    map.set(m, row)
  }
  return [...map.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ ...r, net_savings: r.total_in - r.total_out }))
}

function computeAnomalies(items, multiplier = 2) {
  const debits = items.filter((t) => Number(t.debit || 0) > 0).map((t) => Number(t.debit || 0))
  if (!debits.length) return []
  const sorted = [...debits].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const threshold = median * multiplier
  return items
    .filter((t) => Number(t.debit || 0) >= threshold)
    .sort((a, b) => Number(b.debit || 0) - Number(a.debit || 0))
    .slice(0, 8)
    .map((t) => ({
      category: categorize(t.description),
      description: t.description,
      amount: Number(t.debit || 0),
    }))
}

function computeForecast(monthly, incomeGrowthPct) {
  if (!monthly.length) return { ok: false, error: 'Not enough monthly data.' }
  const last = monthly[monthly.length - 1]
  const nextIncome = Number(last.total_in || 0) * (1 + Number(incomeGrowthPct || 0) / 100)
  const nextExpense = Number(last.total_out || 0)
  return {
    ok: true,
    last_month: last.month,
    predicted_next_month_income: nextIncome,
    predicted_next_month_expense: nextExpense,
    predicted_next_month_savings: nextIncome - nextExpense,
  }
}

function computeSavingsPlan(summary, categories, targetSavings) {
  const totalIn = Number(summary.total_in || 0)
  const totalOut = Number(summary.total_out || 0)
  if (totalOut <= 0) return { ok: false, error: 'No expenses available.' }

  const neededExpense = totalIn - Number(targetSavings || 0)
  const cutNeeded = Math.max(0, totalOut - neededExpense)
  const suggested = categories.map((c) => {
    const share = c.amount / totalOut
    const cut = cutNeeded * share
    return {
      category: c.category,
      current_amount: c.amount,
      suggested_cut: cut,
      suggested_new_budget: Math.max(0, c.amount - cut),
    }
  })
  return {
    ok: true,
    target_savings: Number(targetSavings || 0),
    current_savings: totalIn - totalOut,
    cut_needed: cutNeeded,
    suggested_category_plan: suggested.sort((a, b) => b.suggested_cut - a.suggested_cut),
  }
}

function AuthCard({ mode, onModeChange, onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const isRegister = mode === 'register'
  const emailValid = EMAIL_REGEX.test(email.trim())
  const passwordValid = password.length >= 8

  async function submit(e) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!emailValid) {
      setError('Please enter a valid email address.')
      return
    }
    if (!passwordValid) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)
    try {
      if (isRegister) {
        await fetchJson(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password,
            full_name: fullName,
          }),
        })
        setInfo('Registration successful. Please login to continue.')
        setPassword('')
        setShowPassword(false)
        onModeChange('login')
        return
      }

      const formData = new URLSearchParams()
      formData.set('username', email.trim())
      formData.set('password', password)

      const loginResponse = await fetchJson(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      })
      onLoginSuccess(loginResponse.access_token, loginResponse.user)
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card auth-card">
      <h2>{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
      <p className="muted auth-subtitle">
        {isRegister
          ? 'Use a valid email and strong password to register securely.'
          : 'Login to access Home reports, AI chat, and your finance dashboard.'}
      </p>
      <form onSubmit={submit}>
        {isRegister && (
          <label>
            Full Name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {email && !emailValid && <span className="input-hint error-text">Enter a valid email format.</span>}
        </label>
        <label>
          Password
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <div className="show-password-line">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <span>Show password</span>
          </div>
          {password && !passwordValid && (
            <span className="input-hint error-text">Password must be at least 8 characters.</span>
          )}
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
        </button>
      </form>
      {info && <p className="success-text">{info}</p>}
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
  if (!forecast?.ok) return <div className="card error">Forecast unavailable.</div>

  return (
    <div className="card">
      <h3>Next Month Forecast</h3>
      <p><strong>Based on:</strong> {forecast.last_month}</p>
      <p>Predicted Income: {formatINR(forecast.predicted_next_month_income)}</p>
      <p>Predicted Expense: {formatINR(forecast.predicted_next_month_expense)}</p>
      <p>Predicted Savings: {formatINR(forecast.predicted_next_month_savings)}</p>
    </div>
  )
}

function SavingsPlanCard({ plan }) {
  if (!plan?.ok) return <div className="card error">Savings plan unavailable.</div>

  return (
    <div className="card">
      <h3>Savings Target Plan</h3>
      <p>Target Savings: {formatINR(plan.target_savings)}</p>
      <p>Current Savings: {formatINR(plan.current_savings)}</p>
      <p><strong>Cut Needed:</strong> {formatINR(plan.cut_needed)}</p>

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
            {plan.suggested_category_plan?.slice(0, 8).map((row) => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td>{formatINR(row.current_amount)}</td>
                <td>{formatINR(row.suggested_cut)}</td>
                <td>{formatINR(row.suggested_new_budget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HorizontalBars({ title, items = [], labelKey, valueKey }) {
  if (!items.length) {
    return (
      <div className="card chart-card">
        <h3>{title}</h3>
        <p className="muted">No data available for selected period.</p>
      </div>
    )
  }

  const maxValue = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1)

  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      <div className="bar-chart-list">
        {items.map((item, idx) => {
          const value = Number(item[valueKey] || 0)
          const widthPct = Math.max(4, (value / maxValue) * 100)
          return (
            <div className="bar-chart-row" key={`${item[labelKey]}-${idx}`}>
              <div className="bar-chart-header">
                <span>{item[labelKey]}</span>
                <strong>{formatINR(value)}</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthlyTrendChart({ items = [] }) {
  if (!items.length) {
    return (
      <div className="card chart-card">
        <h3>Monthly Income vs Expense</h3>
        <p className="muted">Upload transactions to see monthly trends.</p>
      </div>
    )
  }

  const maxValue = Math.max(
    ...items.map((m) => Math.max(Number(m.total_in || 0), Number(m.total_out || 0))),
    1,
  )

  return (
    <div className="card chart-card">
      <h3>Monthly Income vs Expense</h3>
      <div className="monthly-bars">
        {items.map((m) => {
          const incomePct = (Number(m.total_in || 0) / maxValue) * 100
          const expensePct = (Number(m.total_out || 0) / maxValue) * 100
          return (
            <div key={m.month} className="monthly-row">
              <div className="monthly-label">{m.month}</div>
              <div className="monthly-track">
                <div className="income-bar" style={{ width: `${Math.max(2, incomePct)}%` }} />
                <div className="expense-bar" style={{ width: `${Math.max(2, expensePct)}%` }} />
              </div>
              <div className="monthly-values">
                <span>In {formatINR(m.total_in)}</span>
                <span>Out {formatINR(m.total_out)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [activePage, setActivePage] = useState('home')

  const [incomeGrowth, setIncomeGrowth] = useState(5)
  const [targetSavings, setTargetSavings] = useState(55000)
  const [model, setModel] = useState('llama3.2:3b')

  const [csvFile, setCsvFile] = useState(null)
  const [statementText, setStatementText] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('all')

  const [error, setError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadTips, setUploadTips] = useState([])
  const [uploadPreviewLines, setUploadPreviewLines] = useState([])

  const [transactions, setTransactions] = useState([])

  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! I am your finance assistant. Ask me about spending, savings, budgets, or trends.',
    },
  ])

  function logout() {
    setToken('')
    setUser(null)
    setTransactions([])
    setUploadMessage('')
    setError('')
    setActivePage('home')
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
      const [settings, tx] = await Promise.all([
        apiGet('/user/settings'),
        apiGet('/user/transactions?limit=2000'),
      ])
      setIncomeGrowth(settings.default_income_growth_pct ?? 5)
      setTargetSavings(settings.default_target_savings ?? 55000)
      setModel(settings.ollama_model || 'llama3.2:3b')
      setTransactions(tx.items || [])
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const monthOptions = useMemo(() => {
    const set = new Set()
    for (const t of transactions) {
      const key = toMonthKey(t.date)
      if (key) set.add(key)
    }
    return ['all', ...[...set].sort((a, b) => b.localeCompare(a))]
  }, [transactions])

  useEffect(() => {
    if (!monthOptions.includes(selectedPeriod)) setSelectedPeriod('all')
  }, [monthOptions, selectedPeriod])

  const filteredTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions
    return transactions.filter((t) => toMonthKey(t.date) === selectedPeriod)
  }, [transactions, selectedPeriod])

  const summary = useMemo(() => computeSummary(filteredTransactions), [filteredTransactions])
  const categories = useMemo(() => computeCategoryBreakdown(filteredTransactions), [filteredTransactions])
  const topExpenses = useMemo(() => computeTopExpenses(filteredTransactions), [filteredTransactions])
  const anomalies = useMemo(() => computeAnomalies(filteredTransactions), [filteredTransactions])

  const monthlyForChart = useMemo(() => {
    if (selectedPeriod === 'all') return computeMonthlySummary(transactions).slice(-8)
    return computeMonthlySummary(filteredTransactions)
  }, [transactions, filteredTransactions, selectedPeriod])

  const forecast = useMemo(
    () => computeForecast(monthlyForChart, incomeGrowth),
    [monthlyForChart, incomeGrowth],
  )
  const plan = useMemo(
    () => computeSavingsPlan(summary, categories, targetSavings),
    [summary, categories, targetSavings],
  )

  const insights = useMemo(() => {
    const topCategory = categories[0]
    const anomalyCount = anomalies.length
    const out = []
    out.push(`Transactions in scope: ${filteredTransactions.length}`)
    if (topCategory) {
      out.push(`Top spend category: ${topCategory.category} (${formatINR(topCategory.amount)})`)
    }
    out.push(`Net savings in selected period: ${formatINR(summary.net_savings)}`)
    out.push(
      anomalyCount
        ? `Detected ${anomalyCount} unusually high expense transactions.`
        : 'No anomaly alerts in selected period.',
    )
    return out
  }, [categories, anomalies, filteredTransactions.length, summary.net_savings])

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
      setUploadMessage('Transaction history cleared.')
    } catch (err) {
      setUploadMessage(`Failed to clear history: ${err.message}`)
    }
  }

  async function downloadWithAuth(path, filename) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function sendChat(e) {
    e.preventDefault()
    const question = chatInput.trim()
    if (!question) return

    setChatMessages((prev) => [...prev, { role: 'user', text: question }])
    setChatInput('')
    setChatLoading(true)
    try {
      const scopedQuestion =
        selectedPeriod === 'all'
          ? question
          : `${question}\n\nConsider this selected period context: ${selectedPeriod}.`
      const data = await apiGet(
        `/user/ai-ask?question=${encodeURIComponent(scopedQuestion)}&model=${encodeURIComponent(model)}`,
      )
      const answer = data?.ok ? data.advice : data?.error || 'Could not generate answer.'
      setChatMessages((prev) => [...prev, { role: 'assistant', text: answer }])
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${err.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-layout">
          <div className="card auth-copy">
            <h1>Personal Finance Copilot</h1>
            <p>
              Analyze spending with charts, discuss with AI, and download comprehensive reports.
            </p>
            <ul>
              <li>Home dashboard with month/year or all-time filtering</li>
              <li>AI feature chat for finance questions</li>
              <li>Downloadable reports with detailed finance insights</li>
            </ul>
          </div>
          <AuthCard
            mode={authMode}
            onModeChange={(m) => setAuthMode(m)}
            onLoginSuccess={onLoginSuccess}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <div className="brand">Finance Copilot</div>
        <div className="nav-links">
          <button className={`nav-tab ${activePage === 'home' ? 'active' : ''}`} onClick={() => setActivePage('home')}>Home</button>
          <button className={`nav-tab ${activePage === 'ai' ? 'active' : ''}`} onClick={() => setActivePage('ai')}>AI Feature</button>
        </div>
        <div className="nav-user">
          <span>{user?.full_name || user?.email}</span>
          <button className="secondary-btn" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page">
        {activePage === 'home' && (
          <>
            <div className="welcome-row card">
              <h1>Home Dashboard</h1>
              <p>Filter data by month-year or all-time, upload statements, and review professional reports.</p>
            </div>

            <div className="card">
              <h3>Scope & Controls</h3>
              <div className="row">
                <label>
                  Select Period
                  <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>{m === 'all' ? 'All Time' : monthLabel(m)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Income Growth % (forecast)
                  <input type="number" value={incomeGrowth} onChange={(e) => setIncomeGrowth(e.target.value)} />
                </label>
              </div>
              <p className="muted">
                Showing data for: <strong>{selectedPeriod === 'all' ? 'All Time' : monthLabel(selectedPeriod)}</strong>
              </p>
            </div>

            <div className="card">
              <h3>Upload Data (CSV or Text)</h3>
              <div className="upload-grid">
                <div className="upload-card-lite">
                  <h4>Upload Bank CSV</h4>
                  <p className="muted">Best for bulk transaction uploads from statement exports.</p>
                  <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                  <button onClick={uploadCsv} disabled={!csvFile}>Upload CSV</button>
                </div>

                <div className="upload-card-lite">
                  <h4>Paste Statement Text</h4>
                  <p className="muted">Paste OCR or copied statement lines and let parser structure them.</p>
                  <textarea
                    rows={6}
                    value={statementText}
                    onChange={(e) => setStatementText(e.target.value)}
                    placeholder="Paste transaction lines..."
                  />
                  <button onClick={uploadStatementText} disabled={!statementText.trim()}>Upload Text</button>
                </div>
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

            <div className="metrics-grid">
              <div className="metric-card">
                <span>Total In</span>
                <strong>{formatINR(summary.total_in)}</strong>
              </div>
              <div className="metric-card">
                <span>Total Out</span>
                <strong>{formatINR(summary.total_out)}</strong>
              </div>
              <div className="metric-card">
                <span>Net Savings</span>
                <strong>{formatINR(summary.net_savings)}</strong>
              </div>
            </div>

            <div className="grid">
              <HorizontalBars
                title="Spending by Category"
                items={categories.slice(0, 8)}
                labelKey="category"
                valueKey="amount"
              />
              <MonthlyTrendChart items={monthlyForChart} />
            </div>

            <div className="grid insights-grid">
              <div className="card chart-card">
                <h3>Top Expenses</h3>
                {topExpenses.length ? (
                  <ul className="insight-list">
                    {topExpenses.map((item, idx) => (
                      <li key={`${item.description}-${idx}`}>
                        <div>
                          <strong>{item.description}</strong>
                          <span>{item.date}</span>
                        </div>
                        <b>{formatINR(item.amount)}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No top expenses yet.</p>
                )}
              </div>

              <div className="card chart-card">
                <h3>Detailed Insights</h3>
                <ul className="insight-list">
                  {insights.map((line, idx) => (
                    <li key={idx}><div><strong>{line}</strong></div></li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid">
              <ForecastCard forecast={forecast} />
              <SavingsPlanCard plan={plan} />
            </div>

            <div className="card">
              <h3>Reports, Settings & Actions</h3>
              <div className="row">
                <label>
                  Target Savings (₹)
                  <input type="number" value={targetSavings} onChange={(e) => setTargetSavings(e.target.value)} />
                </label>
                <div className="muted settings-note">AI model is managed automatically from your saved backend settings.</div>
              </div>
              <div className="button-row">
                <button onClick={saveSettings}>Save Settings</button>
                <button className="secondary-btn" onClick={() => downloadWithAuth('/user/reports/transactions.csv', 'transactions_report.csv')}>Download CSV</button>
                <button className="secondary-btn" onClick={() => downloadWithAuth('/user/reports/summary.pdf', 'finance_summary_report.pdf')}>Download Full PDF Report</button>
                <button className="danger-btn" onClick={clearHistory}>Clear History</button>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>

            <div className="card">
              <h3>Transactions ({filteredTransactions.length})</h3>
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
                    {filteredTransactions.map((t) => (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td>{t.description}</td>
                        <td>{formatINR(t.debit)}</td>
                        <td>{formatINR(t.credit)}</td>
                        <td>{t.source_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activePage === 'ai' && (
          <>
            <div className="welcome-row card">
              <h1>AI Feature</h1>
              <p>Chat with your finance assistant about expenses, budgets, and savings strategy.</p>
            </div>

            <div className="card ai-chat-card">
              <div className="chat-window">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className={`chat-bubble ${m.role}`}>
                    <strong>{m.role === 'assistant' ? 'AI' : 'You'}</strong>
                    <p>{m.text}</p>
                  </div>
                ))}
                {chatLoading && <p className="muted">AI is typing...</p>}
              </div>
              <form className="chat-form" onSubmit={sendChat}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your spending, saving strategy, or monthly trends..."
                />
                <button type="submit" disabled={chatLoading || !chatInput.trim()}>Send</button>
              </form>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
