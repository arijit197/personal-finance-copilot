import { useEffect, useMemo, useState } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Input, Select, Textarea } from './components/ui/input'
import { Container, Section } from './components/ui/layout'

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
const PIE_COLORS = ['#fafafa', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a']

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

function Field({ label, hint, error, children }) {
  return (
    <label className="flex flex-col gap-3 text-sm font-medium text-text-secondary">
      <span className="label-text">{label}</span>
      {children}
      {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  )
}

function StatCard({ label, value }) {
  return (
    <Card className="bg-accent-gradient">
      <CardContent className="space-y-3">
        <p className="label-text">{label}</p>
        <p className="metric-value">{value}</p>
      </CardContent>
    </Card>
  )
}

function SectionIntro({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl space-y-3">
        {eyebrow ? <p className="label-text">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-[0.04em] text-text-primary lg:text-4xl">{title}</h1>
        {description ? <p className="text-sm leading-7 text-text-secondary lg:text-base">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  )
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
    <Card className="w-full max-w-xl bg-bg-elevated/95">
      <CardHeader>
        <p className="label-text">{isRegister ? 'Create profile' : 'Welcome back'}</p>
        <CardTitle className="text-2xl lg:text-3xl">
          {isRegister ? 'Create your account' : 'Sign in to Finance Copilot'}
        </CardTitle>
        <CardDescription>
          {isRegister
            ? 'Use a valid email and strong password to register securely.'
            : 'Login to access Home reports, AI chat, and your finance dashboard.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          {isRegister && (
            <Field label="Full Name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
          )}

          <Field
            label="Email"
            error={email && !emailValid ? 'Enter a valid email format.' : ''}
          >
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>

          <Field
            label="Password"
            error={password && !passwordValid ? 'Password must be at least 8 characters.' : ''}
          >
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <label className="flex items-center gap-3 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 rounded border-border-subtle bg-bg-secondary accent-white"
              />
              <span>Show password</span>
            </label>
          </Field>

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
          </Button>
        </form>

        {info ? <p className="text-sm text-emerald-300">{info}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <p className="text-sm text-text-secondary">
          {isRegister ? 'Already have account?' : 'New here?'}{' ' }
          <button
            className="font-semibold text-text-primary transition duration-200 hover:opacity-80"
            onClick={() => onModeChange(isRegister ? 'login' : 'register')}
          >
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>
      </CardContent>
    </Card>
  )
}

function ForecastCard({ forecast }) {
  if (!forecast?.ok) {
    return (
      <Card className="border-red-950 bg-red-950/20">
        <CardTitle>Forecast unavailable.</CardTitle>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next Month Forecast</CardTitle>
        <CardDescription>Projection based on your latest monthly performance.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="surface-muted rounded-2xl p-4">
          <p className="label-text">Based on</p>
          <p className="mt-3 text-base font-semibold text-text-primary">{forecast.last_month}</p>
        </div>
        <div className="surface-muted rounded-2xl p-4">
          <p className="label-text">Predicted Savings</p>
          <p className="mt-3 text-base font-semibold text-text-primary">{formatINR(forecast.predicted_next_month_savings)}</p>
        </div>
        <div className="surface-muted rounded-2xl p-4">
          <p className="label-text">Predicted Income</p>
          <p className="mt-3 text-base font-semibold text-text-primary">{formatINR(forecast.predicted_next_month_income)}</p>
        </div>
        <div className="surface-muted rounded-2xl p-4">
          <p className="label-text">Predicted Expense</p>
          <p className="mt-3 text-base font-semibold text-text-primary">{formatINR(forecast.predicted_next_month_expense)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function SavingsPlanCard({ plan }) {
  if (!plan?.ok) {
    return (
      <Card className="border-red-950 bg-red-950/20">
        <CardTitle>Savings plan unavailable.</CardTitle>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Savings Target Plan</CardTitle>
        <CardDescription>Suggested category adjustments to match your target savings.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface-muted rounded-2xl p-4">
            <p className="label-text">Target Savings</p>
            <p className="mt-3 text-base font-semibold text-text-primary">{formatINR(plan.target_savings)}</p>
          </div>
          <div className="surface-muted rounded-2xl p-4">
            <p className="label-text">Current Savings</p>
            <p className="mt-3 text-base font-semibold text-text-primary">{formatINR(plan.current_savings)}</p>
          </div>
          <div className="surface-muted rounded-2xl p-4">
            <p className="label-text">Cut Needed</p>
            <p className="mt-3 text-base font-semibold text-text-primary">{formatINR(plan.cut_needed)}</p>
          </div>
        </div>

        <div className="table-shell overflow-x-auto">
          <table className="min-w-full text-left text-sm text-text-secondary">
            <thead className="border-b border-border-subtle text-xs uppercase tracking-[0.18em] text-text-muted">
              <tr>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">Current</th>
                <th className="px-4 py-4">Suggested Cut</th>
                <th className="px-4 py-4">New Budget</th>
              </tr>
            </thead>
            <tbody>
              {plan.suggested_category_plan?.slice(0, 8).map((row) => (
                <tr key={row.category} className="border-b border-border-subtle/80 last:border-b-0">
                  <td className="px-4 py-4 text-text-primary">{row.category}</td>
                  <td className="px-4 py-4">{formatINR(row.current_amount)}</td>
                  <td className="px-4 py-4">{formatINR(row.suggested_cut)}</td>
                  <td className="px-4 py-4">{formatINR(row.suggested_new_budget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function HorizontalBars({ title, items = [], labelKey, valueKey }) {
  if (!items.length) {
    return (
      <Card>
        <CardTitle>{title}</CardTitle>
        <CardDescription>No data available for selected period.</CardDescription>
      </Card>
    )
  }

  const maxValue = Math.max(...items.map((item) => Number(item[valueKey] || 0)), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Category-level expense intensity across the selected scope.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, idx) => {
            const value = Number(item[valueKey] || 0)
            const widthPct = Math.max(4, (value / maxValue) * 100)
            return (
              <div className="space-y-2" key={`${item[labelKey]}-${idx}`}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-text-secondary">{item[labelKey]}</span>
                  <strong className="font-semibold text-text-primary">{formatINR(value)}</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-zinc-500 to-zinc-100"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ExpensePieChart({ title, items = [] }) {
  const validItems = items.filter((item) => Number(item.amount || 0) > 0)
  if (!validItems.length) {
    return (
      <Card>
        <CardTitle>{title}</CardTitle>
        <CardDescription>No expense data available for pie view.</CardDescription>
      </Card>
    )
  }

  const topItems = validItems.slice(0, 6)
  const otherAmount = validItems.slice(6).reduce((sum, i) => sum + Number(i.amount || 0), 0)
  const pieItems = otherAmount > 0 ? [...topItems, { category: 'Other', amount: otherAmount }] : topItems
  const total = pieItems.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const cx = 90
  const cy = 90
  const r = 70
  const polar = (angle) => {
    const rad = (angle * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  let running = 0
  const slices = pieItems.map((item, idx) => {
    const value = Number(item.amount || 0)
    const ratio = value / total
    const start = running * 360 - 90
    running += ratio
    const end = running * 360 - 90
    const sweep = end - start

    if (sweep >= 359.999) {
      return (
        <circle
          key={`slice-${item.category}-${idx}`}
          cx={cx}
          cy={cy}
          r={r}
          fill={PIE_COLORS[idx % PIE_COLORS.length]}
          stroke="#0b0b0b"
          strokeWidth="1"
        />
      )
    }

    const p1 = polar(start)
    const p2 = polar(end)
    const largeArc = sweep > 180 ? 1 : 0
    const d = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`

    return (
      <path
        key={`slice-${item.category}-${idx}`}
        d={d}
        fill={PIE_COLORS[idx % PIE_COLORS.length]}
        stroke="#0b0b0b"
        strokeWidth="1"
      />
    )
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Relative spend distribution across your highest categories.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[220px_1fr] xl:items-center">
        <div className="mx-auto w-[180px]">
          <svg viewBox="0 0 180 180" role="img" aria-label="Expense pie chart" className="h-[180px] w-[180px]">
            {slices}
            <circle cx={cx} cy={cy} r="26" fill="#0b0b0b" />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="#a1a1aa">Total</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#ffffff" fontWeight="700">{formatINR(total)}</text>
          </svg>
        </div>

        <ul className="grid gap-3">
          {pieItems.map((item, idx) => {
            const value = Number(item.amount || 0)
            const pct = ((value / total) * 100).toFixed(1)
            return (
              <li key={`${item.category}-${idx}`} className="surface-muted flex items-center gap-3 rounded-2xl p-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                />
                <div className="flex flex-col gap-1">
                  <strong className="text-sm font-semibold text-text-primary">{item.category}</strong>
                  <small className="text-xs text-text-muted">{formatINR(value)} ({pct}%)</small>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function MonthlyTrendChart({ items = [] }) {
  if (!items.length) {
    return (
      <Card>
        <CardTitle>Monthly Income vs Expense</CardTitle>
        <CardDescription>Upload transactions to see monthly trends.</CardDescription>
      </Card>
    )
  }

  const maxValue = Math.max(
    ...items.map((m) => Math.max(Number(m.total_in || 0), Number(m.total_out || 0))),
    1,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Income vs Expense</CardTitle>
        <CardDescription>Track how inflows and outflows evolve over time.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {items.map((m) => {
            const incomePct = (Number(m.total_in || 0) / maxValue) * 100
            const expensePct = (Number(m.total_out || 0) / maxValue) * 100
            return (
              <div key={m.month} className="grid gap-3 lg:grid-cols-[110px_1fr] lg:items-center">
                <div className="text-sm font-semibold text-text-primary">{m.month}</div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs uppercase tracking-[0.18em] text-text-muted">
                      <span>Income</span>
                      <span>{formatINR(m.total_in)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-white"
                        style={{ width: `${Math.max(2, incomePct)}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs uppercase tracking-[0.18em] text-text-muted">
                      <span>Expense</span>
                      <span>{formatINR(m.total_out)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-zinc-700 to-zinc-400"
                        style={{ width: `${Math.max(2, expensePct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
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
      <div className="min-h-screen bg-bg-primary px-5 py-8 lg:px-8 lg:py-10">
        <Container>
          <div className="grid gap-6 lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <Card className="bg-gradient-to-br from-bg-secondary to-bg-elevated">
              <CardHeader className="max-w-2xl">
                <p className="label-text">Personal Finance Copilot</p>
                <h1 className="text-4xl font-semibold tracking-[0.06em] text-text-primary lg:text-5xl">
                  Premium insights for every rupee you earn, spend, and save.
                </h1>
                <CardDescription className="text-base leading-7">
                  Analyze spending with charts, discuss with AI, and download comprehensive reports.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-4 text-sm leading-7 text-text-secondary">
                  <li className="surface-muted rounded-2xl p-4">Home dashboard with month/year or all-time filtering</li>
                  <li className="surface-muted rounded-2xl p-4">AI feature chat for finance questions</li>
                  <li className="surface-muted rounded-2xl p-4">Downloadable reports with detailed finance insights</li>
                </ul>
              </CardContent>
            </Card>

            <AuthCard
              mode={authMode}
              onModeChange={(m) => setAuthMode(m)}
              onLoginSuccess={onLoginSuccess}
            />
          </div>
        </Container>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-black/85 backdrop-blur-xl">
        <Container className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="label-text">Finance Copilot</p>
            <p className="mt-2 text-sm text-text-secondary">Premium command center for your money.</p>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-bg-secondary p-1">
              <Button variant={activePage === 'home' ? 'primary' : 'ghost'} onClick={() => setActivePage('home')}>
                Home
              </Button>
              <Button variant={activePage === 'ai' ? 'primary' : 'ghost'} onClick={() => setActivePage('ai')}>
                AI Feature
              </Button>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <span className="text-sm text-text-secondary">{user?.full_name || user?.email}</span>
              <Button variant="secondary" onClick={logout}>Logout</Button>
            </div>
          </div>
        </Container>
      </header>

      <Container className="py-8 lg:py-10">
        {activePage === 'home' && (
          <Section>
            <SectionIntro
              eyebrow="Home Dashboard"
              title="A cleaner view of your financial pulse"
              description="Filter data by month-year or all-time, upload statements, and review professional reports in a premium dark workspace."
            />

            <Card>
              <CardHeader>
                <CardTitle>Scope & Controls</CardTitle>
                <CardDescription>
                  Showing data for: <strong className="text-text-primary">{selectedPeriod === 'all' ? 'All Time' : monthLabel(selectedPeriod)}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-2">
                <Field label="Select Period">
                  <Select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>{m === 'all' ? 'All Time' : monthLabel(m)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Income Growth % (forecast)">
                  <Input type="number" value={incomeGrowth} onChange={(e) => setIncomeGrowth(e.target.value)} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upload Data</CardTitle>
                <CardDescription>Upload CSV files or paste statement text for parsing.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 xl:grid-cols-2">
                <div className="surface-muted rounded-2xl p-5">
                  <div className="space-y-2">
                    <p className="label-text">Upload Bank CSV</p>
                    <h4 className="text-lg font-semibold text-text-primary">Bulk transaction imports</h4>
                    <p className="text-sm leading-6 text-text-secondary">Best for statement exports and structured history uploads.</p>
                  </div>
                  <div className="mt-5 space-y-4">
                    <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                    <Button onClick={uploadCsv} disabled={!csvFile}>Upload CSV</Button>
                  </div>
                </div>

                <div className="surface-muted rounded-2xl p-5">
                  <div className="space-y-2">
                    <p className="label-text">Paste Statement Text</p>
                    <h4 className="text-lg font-semibold text-text-primary">OCR-friendly parser</h4>
                    <p className="text-sm leading-6 text-text-secondary">Paste OCR or copied statement lines and let the parser structure them.</p>
                  </div>
                  <div className="mt-5 space-y-4">
                    <Textarea
                      rows={6}
                      value={statementText}
                      onChange={(e) => setStatementText(e.target.value)}
                      placeholder="Paste transaction lines..."
                    />
                    <Button onClick={uploadStatementText} disabled={!statementText.trim()}>Upload Text</Button>
                  </div>
                </div>

                {uploadMessage ? (
                  <div className="xl:col-span-2 rounded-2xl border border-border-subtle bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
                    {uploadMessage}
                  </div>
                ) : null}

                {uploadTips.length > 0 ? (
                  <div className="xl:col-span-2 rounded-2xl border border-red-950 bg-red-950/20 p-4 text-sm text-red-200">
                    <strong className="block text-xs uppercase tracking-[0.18em] text-red-300">Parsing Tips</strong>
                    <ul className="mt-3 list-disc space-y-2 pl-5">
                      {uploadTips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {uploadPreviewLines.length > 0 ? (
                  <details className="xl:col-span-2 rounded-2xl border border-border-subtle bg-bg-secondary p-4 text-sm text-text-secondary">
                    <summary className="cursor-pointer font-semibold text-text-primary">Text preview</summary>
                    <pre className="mt-4 whitespace-pre-wrap font-sans leading-7">{uploadPreviewLines.join('\n')}</pre>
                  </details>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-3">
              <StatCard label="Total In" value={formatINR(summary.total_in)} />
              <StatCard label="Total Out" value={formatINR(summary.total_out)} />
              <StatCard label="Net Savings" value={formatINR(summary.net_savings)} />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <ExpensePieChart title="Expense Distribution (Pie)" items={categories} />
              <HorizontalBars
                title="Spending by Category"
                items={categories.slice(0, 8)}
                labelKey="category"
                valueKey="amount"
              />
            </div>

            <MonthlyTrendChart items={monthlyForChart} />

            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Expenses</CardTitle>
                  <CardDescription>Largest expense transactions in the selected scope.</CardDescription>
                </CardHeader>
                <CardContent>
                  {topExpenses.length ? (
                    <ul className="grid gap-3">
                      {topExpenses.map((item, idx) => (
                        <li key={`${item.description}-${idx}`} className="surface-muted flex items-center justify-between gap-4 rounded-2xl p-4">
                          <div className="space-y-1">
                            <strong className="block text-sm font-semibold text-text-primary">{item.description}</strong>
                            <span className="text-xs text-text-muted">{item.date}</span>
                          </div>
                          <b className="whitespace-nowrap text-sm font-semibold text-text-primary">{formatINR(item.amount)}</b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-secondary">No top expenses yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Insights</CardTitle>
                  <CardDescription>Summarized observations from the current selection.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-3">
                    {insights.map((line, idx) => (
                      <li key={idx} className="surface-muted rounded-2xl p-4 text-sm font-medium text-text-primary">{line}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <ForecastCard forecast={forecast} />
              <SavingsPlanCard plan={plan} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Reports, Settings & Actions</CardTitle>
                <CardDescription>Persist preferences and export finance reports.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                  <Field label="Target Savings (₹)">
                    <Input type="number" value={targetSavings} onChange={(e) => setTargetSavings(e.target.value)} />
                  </Field>
                  <div className="rounded-2xl border border-dashed border-border-subtle bg-bg-secondary p-4 text-sm leading-6 text-text-secondary">
                    AI model is managed automatically from your saved backend settings.
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={saveSettings}>Save Settings</Button>
                  <Button variant="secondary" onClick={() => downloadWithAuth('/user/reports/transactions.csv', 'transactions_report.csv')}>
                    Download CSV
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => downloadWithAuth(`/user/reports/summary.pdf?period=${encodeURIComponent(selectedPeriod)}`, 'finance_summary_report.pdf')}
                  >
                    Download Full PDF Report
                  </Button>
                  <Button variant="danger" onClick={clearHistory}>Clear History</Button>
                </div>

                {error ? <p className="text-sm text-red-300">{error}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
                <CardDescription>Detailed ledger view for the current scope.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="table-shell overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-text-secondary">
                    <thead className="border-b border-border-subtle text-xs uppercase tracking-[0.18em] text-text-muted">
                      <tr>
                        <th className="px-4 py-4">Date</th>
                        <th className="px-4 py-4">Description</th>
                        <th className="px-4 py-4">Debit</th>
                        <th className="px-4 py-4">Credit</th>
                        <th className="px-4 py-4">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((t) => (
                        <tr key={t.id} className="border-b border-border-subtle/80 last:border-b-0">
                          <td className="px-4 py-4">{t.date}</td>
                          <td className="px-4 py-4 text-text-primary">{t.description}</td>
                          <td className="px-4 py-4">{formatINR(t.debit)}</td>
                          <td className="px-4 py-4">{formatINR(t.credit)}</td>
                          <td className="px-4 py-4">{t.source_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </Section>
        )}

        {activePage === 'ai' && (
          <Section>
            <SectionIntro
              eyebrow="AI Feature"
              title="Discuss your money with context-aware assistance"
              description="Chat with your finance assistant about expenses, budgets, and savings strategy with the current scope applied automatically."
            />

            <Card>
              <CardHeader>
                <CardTitle>AI Conversation</CardTitle>
                <CardDescription>Ask about your spending, saving strategy, or monthly trends.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid max-h-[520px] min-h-[340px] gap-4 overflow-y-auto rounded-2xl border border-border-subtle bg-bg-secondary p-4">
                  {chatMessages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                        m.role === 'assistant'
                          ? 'border-border-subtle bg-bg-elevated text-text-primary'
                          : 'justify-self-end border-zinc-700 bg-white text-black'
                      }`}
                    >
                      <strong className="text-xs uppercase tracking-[0.18em] opacity-70">
                        {m.role === 'assistant' ? 'AI' : 'You'}
                      </strong>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{m.text}</p>
                    </div>
                  ))}
                  {chatLoading ? <p className="text-sm text-text-secondary">AI is typing...</p> : null}
                </div>

                <form className="grid gap-3 lg:grid-cols-[1fr_auto]" onSubmit={sendChat}>
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about your spending, saving strategy, or monthly trends..."
                  />
                  <Button type="submit" disabled={chatLoading || !chatInput.trim()}>Send</Button>
                </form>
              </CardContent>
            </Card>
          </Section>
        )}
      </Container>
    </div>
  )
}
