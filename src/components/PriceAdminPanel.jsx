import { useState } from 'react'

const CITY_COLS = [
  { id: 'lagos', label: 'Lagos' },
  { id: 'abuja', label: 'Abuja' },
  { id: 'portHarcourt', label: 'PH' },
]

function safeParseJson(text) {
  try {
    return { parsed: JSON.parse(text), error: null }
  } catch (err) {
    return { parsed: null, error: err.message }
  }
}

function getCityAmount(row, city) {
  const entry = row?.prices?.[city]
  if (!entry || entry.type !== 'fixed') return ''
  return String(entry.amount)
}

function CustomPriceTable({ draft, onDraftChange }) {
  const { parsed, error } = safeParseJson(draft)

  if (error) {
    return <p className="muted small" style={{ color: 'var(--color-danger, #dc2626)' }}>JSON parse error: {error}</p>
  }

  if (!Array.isArray(parsed)) {
    return <p className="muted small">Draft is not an array — switch to JSON view to fix it.</p>
  }

  function updateCityPrice(index, city, rawValue) {
    const amount = rawValue.trim() === '' ? null : Number(rawValue)
    const next = parsed.map((row, i) => {
      if (i !== index) return row
      const nextPrices = { ...row.prices }
      if (amount == null || isNaN(amount) || amount < 0) {
        delete nextPrices[city]
      } else {
        nextPrices[city] = { type: 'fixed', amount }
      }
      return { ...row, prices: nextPrices }
    })
    onDraftChange(JSON.stringify(next, null, 2))
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={thStyle}>Flower / Item</th>
            <th style={thStyle}>Unit</th>
            {CITY_COLS.map((col) => (
              <th key={col.id} style={{ ...thStyle, textAlign: 'right' }}>{col.label} (₦)</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsed.map((row, index) => (
            <tr key={row.id || index} style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
              <td style={tdStyle}>
                <strong style={{ fontSize: '13px' }}>{row.name}</strong>
                <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-muted, #6b7280)' }}>{row.sku}</p>
              </td>
              <td style={{ ...tdStyle, color: 'var(--color-muted, #6b7280)', fontSize: '12px' }}>{row.unit}</td>
              {CITY_COLS.map((col) => (
                <td key={col.id} style={{ ...tdStyle, textAlign: 'right' }}>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={getCityAmount(row, col.id)}
                    onChange={(e) => updateCityPrice(index, col.id, e.target.value)}
                    placeholder="—"
                    style={priceInputStyle}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const MARKET_CITY_OPTIONS = [
  { id: 'lagos', label: 'Lagos' },
  { id: 'abuja', label: 'Abuja' },
  { id: 'portHarcourt', label: 'PH' },
]

function MarketOverrideTable({ draft, onDraftChange }) {
  const [activeCity, setActiveCity] = useState('lagos')
  const { parsed, error } = safeParseJson(draft)

  if (error) {
    return <p className="muted small" style={{ color: 'var(--color-danger, #dc2626)' }}>JSON parse error: {error}</p>
  }

  const cityRows = Array.isArray(parsed?.[activeCity]) ? parsed[activeCity] : []

  function getRowPrice(row) {
    const price = row.prices?.[activeCity] || row.price
    return price?.type === 'fixed' ? String(price.amount) : ''
  }

  function updateRowPrice(sku, rawValue) {
    if (!parsed) return
    const amount = rawValue.trim() === '' ? null : Number(rawValue)
    const rows = Array.isArray(parsed[activeCity]) ? parsed[activeCity] : []
    const existingIdx = rows.findIndex((r) => r.sku === sku)

    let nextRows
    if (amount == null || isNaN(amount) || amount < 0) {
      nextRows = rows.filter((r) => r.sku !== sku)
    } else if (existingIdx >= 0) {
      nextRows = rows.map((r, i) =>
        i === existingIdx ? { ...r, price: { type: 'fixed', amount } } : r,
      )
    } else {
      nextRows = [...rows, { sku, price: { type: 'fixed', amount }, evidence: 'Admin table edit' }]
    }

    onDraftChange(JSON.stringify({ ...parsed, [activeCity]: nextRows }, null, 2))
  }

  return (
    <div className="stack-gap compact">
      <div className="theme-switcher" role="group" aria-label="City tabs">
        {MARKET_CITY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`theme-chip ${activeCity === opt.id ? 'theme-chip-active' : ''}`}
            onClick={() => setActiveCity(opt.id)}
          >
            {opt.label} ({Array.isArray(parsed?.[opt.id]) ? parsed[opt.id].length : 0})
          </button>
        ))}
      </div>

      {cityRows.length === 0 ? (
        <p className="muted small">No {activeCity} overrides loaded yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={thStyle}>SKU</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Price (₦)</th>
              </tr>
            </thead>
            <tbody>
              {cityRows.map((row) => (
                <tr key={row.sku} style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
                  <td style={tdStyle}><strong style={{ fontSize: '13px' }}>{row.sku}</strong></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={getRowPrice(row)}
                      onChange={(e) => updateRowPrice(row.sku, e.target.value)}
                      style={priceInputStyle}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thStyle = {
  background: 'var(--color-surface-2, #f9fafb)',
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 600,
  borderBottom: '2px solid var(--color-border, #e5e7eb)',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tdStyle = {
  padding: '8px 10px',
  verticalAlign: 'middle',
}

const priceInputStyle = {
  width: '90px',
  textAlign: 'right',
  padding: '4px 6px',
  fontSize: '13px',
  border: '1px solid var(--color-border, #e5e7eb)',
  borderRadius: '6px',
  background: 'var(--color-surface, #fff)',
  color: 'inherit',
}

export function PriceAdminPanel({
  marketOverrideDraft,
  customPricesDraft,
  adminFeedback,
  adminValidation,
  adminLastAppliedAt,
  onMarketOverrideDraftChange,
  onCustomPricesDraftChange,
  onApplyMarketOverrides,
  onApplyCustomPrices,
  onExportMarketOverrides,
  onExportCustomPrices,
  onImportDraftFile,
  onReset,
}) {
  const [customView, setCustomView] = useState('table')
  const [marketView, setMarketView] = useState('table')

  function formatDraft(draft, setter) {
    try {
      setter(JSON.stringify(JSON.parse(draft), null, 2))
    } catch {
      // leave as-is if invalid
    }
  }

  return (
    <div className="stack-gap compact">
      <div className="schema-card stack-gap compact">
        <div className="summary-row">
          <strong>Local pricing manager</strong>
          <span className="muted small">Internal only</span>
        </div>
        <p className="muted small">Update prices in the table — changes reflect in the JSON draft. Hit Apply to load them into the current session.</p>
        {adminLastAppliedAt ? (
          <p className="muted small">Last applied: {new Date(adminLastAppliedAt).toLocaleString('en-NG')}</p>
        ) : null}
        {adminFeedback ? <p className="muted small">{adminFeedback}</p> : null}
        {adminValidation.errors.length > 0 && (
          <div className="note-box">
            {adminValidation.errors.map((item) => (
              <p key={`error-${item}`}>Error: {item}</p>
            ))}
          </div>
        )}
        {adminValidation.warnings.length > 0 && (
          <div className="note-box soft-note">
            {adminValidation.warnings.map((item) => (
              <p key={`warning-${item}`}>Warning: {item}</p>
            ))}
          </div>
        )}
      </div>

      {/* Custom flower prices */}
      <div className="schema-card stack-gap compact">
        <div className="summary-row">
          <strong>Custom flower prices</strong>
          <div className="theme-switcher" role="group">
            <button
              type="button"
              className={`theme-chip ${customView === 'table' ? 'theme-chip-active' : ''}`}
              onClick={() => setCustomView('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={`theme-chip ${customView === 'json' ? 'theme-chip-active' : ''}`}
              onClick={() => setCustomView('json')}
            >
              JSON
            </button>
          </div>
        </div>

        {customView === 'table' ? (
          <CustomPriceTable draft={customPricesDraft} onDraftChange={onCustomPricesDraftChange} />
        ) : (
          <label>
            <span>Custom flower prices draft JSON</span>
            <textarea
              value={customPricesDraft}
              onChange={(e) => onCustomPricesDraftChange(e.target.value)}
              rows={14}
            />
          </label>
        )}

        <div className="button-row">
          <button type="button" className="primary-button" onClick={onApplyCustomPrices}>Apply prices</button>
          <button type="button" className="secondary-button" onClick={onExportCustomPrices}>Download JSON</button>
          {customView === 'json' && (
            <button type="button" className="secondary-button" onClick={() => formatDraft(customPricesDraft, onCustomPricesDraftChange)}>Format JSON</button>
          )}
          <label className="secondary-button compact-button file-button">
            <span>Upload JSON</span>
            <input type="file" accept="application/json,.json" onChange={(e) => onImportDraftFile('custom', e)} />
          </label>
        </div>
      </div>

      {/* Market overrides */}
      <div className="schema-card stack-gap compact">
        <div className="summary-row">
          <strong>Market overrides (catalog bouquets)</strong>
          <div className="theme-switcher" role="group">
            <button
              type="button"
              className={`theme-chip ${marketView === 'table' ? 'theme-chip-active' : ''}`}
              onClick={() => setMarketView('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={`theme-chip ${marketView === 'json' ? 'theme-chip-active' : ''}`}
              onClick={() => setMarketView('json')}
            >
              JSON
            </button>
          </div>
        </div>

        {marketView === 'table' ? (
          <MarketOverrideTable draft={marketOverrideDraft} onDraftChange={onMarketOverrideDraftChange} />
        ) : (
          <label>
            <span>Market override draft JSON</span>
            <textarea
              value={marketOverrideDraft}
              onChange={(e) => onMarketOverrideDraftChange(e.target.value)}
              rows={12}
            />
          </label>
        )}

        <div className="button-row">
          <button type="button" className="primary-button" onClick={onApplyMarketOverrides}>Apply overrides</button>
          <button type="button" className="secondary-button" onClick={onExportMarketOverrides}>Download JSON</button>
          {marketView === 'json' && (
            <button type="button" className="secondary-button" onClick={() => formatDraft(marketOverrideDraft, onMarketOverrideDraftChange)}>Format JSON</button>
          )}
          <label className="secondary-button compact-button file-button">
            <span>Upload JSON</span>
            <input type="file" accept="application/json,.json" onChange={(e) => onImportDraftFile('market', e)} />
          </label>
        </div>
      </div>

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={onReset}>Reset to current defaults</button>
      </div>
      <p className="muted small">Template: Lagos/Abuja/PH override draft follows the same shape as <span className="code-inline">marketOverrides.import.json</span>.</p>
    </div>
  )
}
