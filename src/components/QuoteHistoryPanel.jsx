import { useState } from 'react'
import { getCityLabel, formatCurrency } from '../lib/pricing'

const ORDER_STATUS_OPTIONS = [
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
]

const STATUS_FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  ...ORDER_STATUS_OPTIONS,
]

const STATUS_TONE = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'neutral',
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

function QuoteCard({ quote, onLoadQuote, onDeleteQuote, onUpdateStatus }) {
  const orderStatus = quote.orderStatus || 'pending'
  const tone = STATUS_TONE[orderStatus] || 'neutral'

  return (
    <div className="schema-card stack-gap compact">
      <div className="summary-row">
        <div>
          <strong>{quote.previewLabel || 'Saved quote'}</strong>
          {quote.customerName && (
            <p className="muted small">
              {quote.customerName}
              {quote.customerInstagramHandle ? ` · ${quote.customerInstagramHandle}` : ''}
            </p>
          )}
        </div>
        <strong>{formatCurrency(quote.previewTotal || 0)}</strong>
      </div>

      <div className="summary-row">
        <p className="muted small">
          {getCityLabel(quote.city || 'lagos')} · {quote.quoteType === 'catalog' ? 'Catalog' : 'Custom'}
          {quote.occasion ? ` · ${quote.occasion}` : ''}
        </p>
        <p className="muted small">{formatDate(quote.createdAt)}</p>
      </div>

      <p className="muted small code-inline">{quote.id}</p>

      <div className="button-row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`resolution-banner resolution-${tone}`} style={{ padding: '3px 10px', fontSize: '12px' }}>
          {ORDER_STATUS_OPTIONS.find((o) => o.id === orderStatus)?.label}
        </span>
        <select
          value={orderStatus}
          onChange={(e) => onUpdateStatus(quote.id, e.target.value)}
          style={{ fontSize: '13px' }}
          aria-label="Update quote status"
        >
          {ORDER_STATUS_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        <button type="button" className="secondary-button compact-button" onClick={() => onLoadQuote(quote)}>Open</button>
        <button type="button" className="secondary-button compact-button" onClick={() => onDeleteQuote(quote.id)}>Delete</button>
      </div>
    </div>
  )
}

export function QuoteHistoryPanel({ savedQuotes, savedInvoices, activeRole, onLoadQuote, onDeleteQuote, onUpdateStatus }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded, setExpanded] = useState(false)

  const isFiltering = search.trim() !== '' || statusFilter !== 'all'

  const filtered = savedQuotes.filter((quote) => {
    const orderStatus = quote.orderStatus || 'pending'
    if (statusFilter !== 'all' && orderStatus !== statusFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (quote.customerName || '').toLowerCase().includes(q) ||
      (quote.id || '').toLowerCase().includes(q) ||
      (quote.previewLabel || '').toLowerCase().includes(q) ||
      (quote.customerInstagramHandle || '').toLowerCase().includes(q)
    )
  })

  const statusCounts = ORDER_STATUS_OPTIONS.reduce((acc, opt) => {
    acc[opt.id] = savedQuotes.filter((q) => (q.orderStatus || 'pending') === opt.id).length
    return acc
  }, {})

  const latestQuote = savedQuotes[0]
  const showAll = isFiltering || expanded

  return (
    <section className="panel stack-gap compact" style={{ marginTop: '12px' }}>
      <div className="summary-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow">Quote history</p>
          <p className="muted small">
            {savedQuotes.length} saved · {statusCounts.pending} pending · {statusCounts.confirmed} confirmed · {statusCounts.completed} completed
          </p>
        </div>
        <button
          type="button"
          className="secondary-button compact-button"
          onClick={() => {
            setExpanded((v) => !v)
            if (expanded) {
              setSearch('')
              setStatusFilter('all')
            }
          }}
        >
          {showAll ? 'Collapse' : `View all (${savedQuotes.length})`}
        </button>
      </div>

      {showAll && (
        <div className="field-grid two-up">
          <label>
            <span>Search</span>
            <input
              type="search"
              placeholder="Customer name, quote ID, or bouquet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}{opt.id !== 'all' ? ` (${statusCounts[opt.id]})` : ` (${savedQuotes.length})`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {showAll ? (
        filtered.length === 0 ? (
          <p className="muted small">No quotes match your search or filter.</p>
        ) : (
          <div className="stack-gap compact">
            {filtered.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                onLoadQuote={onLoadQuote}
                onDeleteQuote={onDeleteQuote}
                onUpdateStatus={onUpdateStatus}
              />
            ))}
          </div>
        )
      ) : (
        latestQuote && (
          <QuoteCard
            quote={latestQuote}
            onLoadQuote={onLoadQuote}
            onDeleteQuote={onDeleteQuote}
            onUpdateStatus={onUpdateStatus}
          />
        )
      )}

      {activeRole === 'operations' && savedInvoices.length > 0 && showAll && (
        <details className="details-panel" style={{ marginTop: '8px' }}>
          <summary>Show saved invoices ({savedInvoices.length})</summary>
          <div className="stack-gap compact details-content">
            {savedInvoices.map((item) => (
              <div key={item.id} className="schema-card stack-gap compact">
                <div className="summary-row">
                  <strong>{item.productLabel || item.customerName || 'Saved invoice'}</strong>
                  <span>{formatCurrency(item.total || 0)}</span>
                </div>
                <p className="muted small">{getCityLabel(item.city || 'lagos')} · {item.id}</p>
                <p className="muted small">{formatDate(item.createdAt)}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
