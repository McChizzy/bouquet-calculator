import { useEffect, useMemo, useState } from 'react'

const SALES_ROLE = 'sales'
const OPERATIONS_ROLE = 'operations'
import { pricingCatalog } from './data/pricing'
import { marketOverrideStatus } from './data/sources/marketOverrides'
import { customFlowerWholesalePrices } from './data/sources/customFlowerWholesalePrices'
import {
  createQuoteSummary,
  formatCurrency,
  formatPercentage,
  getCityLabel,
  getPriceBandLabel,
  getPriceTypeLabel,
  getResolutionStatus,
  resolveUnitPrice,
} from './lib/pricing'

const { catalogProducts, cities, components, priceBandOptions, quoteTypes } = pricingCatalog
const initialCustomSelections = components.map((component) => ({ component, count: 0, inputValue: '' }))
const deliveryOptions = Array.from({ length: 59 }, (_, index) => 1000 + (index * 500))
const discountOptions = [5, 10, 15, 20, 25, 30]
const wholesalePriceMap = new Map(customFlowerWholesalePrices.map((item) => [item.id, item]))
const roleOptions = [
  { id: SALES_ROLE, label: 'Sales view' },
  { id: OPERATIONS_ROLE, label: 'Operations view' },
]

const themeOptions = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'dark', label: 'Dark', icon: '🌙' },
  { id: 'night', label: 'Night', icon: '🌌' },
]

function App() {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('bouquet-theme') || 'light')
  const [activeRole, setActiveRole] = useState(() => window.localStorage.getItem('bouquet-role') || OPERATIONS_ROLE)
  const [city, setCity] = useState(cities[0].id)
  const [quoteType, setQuoteType] = useState('custom')
  const [selectedCatalogId, setSelectedCatalogId] = useState(catalogProducts[0].id)
  const [band, setBand] = useState('standard')
  const [quantity, setQuantity] = useState(1)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [customerName, setCustomerName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [occasion, setOccasion] = useState('')
  const [showWholesaleQuote, setShowWholesaleQuote] = useState(false)
  const [customSelections, setCustomSelections] = useState(initialCustomSelections)

  const selectedCatalog = catalogProducts.find((item) => item.id === selectedCatalogId)
  const selectedCatalogPrice = selectedCatalog
    ? resolveUnitPrice({ item: selectedCatalog, city, band, quantity })
    : null
  const selectedCatalogStatus = selectedCatalogPrice ? getResolutionStatus(selectedCatalogPrice, city) : null

  const summary = useMemo(
    () =>
      createQuoteSummary({
        city,
        quoteType,
        catalogSelection: selectedCatalog,
        customSelections,
        quantity,
        band,
        deliveryFee,
        discountPercent,
      }),
    [band, city, customSelections, deliveryFee, discountPercent, quantity, quoteType, selectedCatalog],
  )

  const customerSendText = useMemo(() => {
    const lines = [
      customerName ? `Hi ${customerName},` : 'Hi,',
      `Your bouquet quote is ${formatCurrency(summary.total)}.`,
      occasion ? `Occasion: ${occasion}` : null,
      recipientName ? `Recipient: ${recipientName}` : null,
      'Reply here to confirm and we’ll finalize delivery details.',
      'Bloomfield Flowers 💐',
    ].filter(Boolean)

    return lines.join('\n')
  }, [customerName, occasion, recipientName, summary.total])

  const quoteText = useMemo(() => {
    const introLines = [
      '🌸 *Bloomfield Flowers Quote*',
      customerName ? `Hello ${customerName},` : 'Hello,',
      '',
      `*City:* ${summary.city}`,
      `*Type:* ${quoteType === 'catalog' ? 'Catalog bouquet' : 'Custom bouquet'}`,
      recipientName ? `*Recipient:* ${recipientName}` : null,
      occasion ? `*Occasion:* ${occasion}` : null,
    ].filter(Boolean)

    const itemLines = summary.lineItems.map((item) => `• ${item.label} (${item.detail}) — ${formatCurrency(item.amount)}`)

    const totalLines = [
      '',
      `*Subtotal:* ${formatCurrency(summary.subtotal)}`,
      ...summary.adjustments.map((item) => `*${item.label}:* ${formatCurrency(item.amount)}`),
      `*Total:* ${formatCurrency(summary.total)}`,
      '',
      'Valid for 24 hours, subject to flower availability.',
      'Thank you for choosing Bloomfield Flowers 💐',
    ]

    return [...introLines, '', ...itemLines, ...totalLines].join('\n')
  }, [customerName, occasion, quoteType, recipientName, summary])

  const wholesaleSummary = useMemo(() => {
    const lineItems = []
    const notes = []
    let subtotal = 0

    if (quoteType === 'catalog' && selectedCatalog) {
      notes.push('Wholesale quote is currently supported for custom flower pricing only. Catalog bouquets still need manual wholesale review.')
    }

    if (quoteType === 'custom') {
      customSelections
        .filter((item) => item.count > 0)
        .forEach((item) => {
          const wholesaleItem = wholesalePriceMap.get(item.component.id)
          const wholesaleEntry = wholesaleItem?.prices?.[city]

          if (!wholesaleEntry) {
            notes.push(`${item.component.name} has no confirmed wholesale ${getCityLabel(city)} price yet.`)
            return
          }

          const lineSubtotal = wholesaleEntry.amount * item.count
          subtotal += lineSubtotal
          lineItems.push({
            label: item.component.name,
            detail: `${formatCurrency(wholesaleEntry.amount)} x ${item.count} ${item.component.unit}${item.count === 1 ? '' : 's'}`,
            amount: lineSubtotal,
          })
        })
    }

    const discountAmount = Math.round(subtotal * ((discountPercent || 0) / 100))
    const adjustments = [
      { label: 'Delivery', amount: deliveryFee },
      { label: `Discount (${formatPercentage(discountPercent || 0)})`, amount: -discountAmount },
    ].filter((item) => item.amount !== 0)

    return {
      subtotal,
      adjustments,
      total: subtotal + adjustments.reduce((sum, item) => sum + item.amount, 0),
      lineItems,
      notes,
    }
  }, [city, customSelections, deliveryFee, discountPercent, quoteType, selectedCatalog])

  const customerQuoteText = useMemo(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    let productName = 'Custom bouquet'
    if (quoteType === 'catalog' && selectedCatalog) {
      productName = selectedCatalog.name
    } else if (quoteType === 'custom') {
      const nonZeroItems = customSelections.filter((selection) => selection.count > 0)
      if (nonZeroItems.length === 1) {
        productName = `${nonZeroItems[0].component.name} Custom bouquet`
      } else if (nonZeroItems.length > 1) {
        productName = `${nonZeroItems.map((selection) => selection.component.name).join(', and ')} Custom bouquet`
      }
    }

    return [
      '*Bloomfield Flowers Quote*',
      `Date: ${dateStr}`,
      customerName ? `Hello, ${customerName}` : 'Hello,',
      `*Product Name:* ${productName}`,
      `*Bouquet Price:* ${formatCurrency(summary.total)}`,
      'Order note:',
      'Contact Number:',
      'Contact Address:',
      'Email address:',
      '',
      'Valid for 24 hours, subject to flower availability.',
      'Thank you for choosing Bloomfield Flowers 💐',
    ].join('\n')
  }, [customerName, customSelections, quoteType, selectedCatalog, summary.total])

  async function copyCustomerSendText() {
    try {
      await navigator.clipboard.writeText(customerSendText)
      window.alert('Customer send text copied to clipboard.')
    } catch {
      window.alert('Clipboard unavailable. Copy manually from the customer send preview panel.')
    }
  }

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(quoteText)
      window.alert('Quote copied to clipboard.')
    } catch {
      window.alert('Clipboard unavailable. Copy manually from the preview panel.')
    }
  }

  const wholesaleQuoteText = useMemo(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    return [
      '*Bloomfield Flowers Wholesale Quote*',
      `Date: ${dateStr}`,
      customerName ? `Hello ${customerName},` : 'Hello,',
      '',
      ...(wholesaleSummary.lineItems.length > 0
        ? wholesaleSummary.lineItems.map((item) => `• ${item.label} (${item.detail}) — ${formatCurrency(item.amount)}`)
        : ['No wholesale-priced items selected yet.']),
      ...(wholesaleSummary.notes.length > 0 ? ['', ...wholesaleSummary.notes.map((note) => `Note: ${note}`)] : []),
      '',
      `*Subtotal:* ${formatCurrency(wholesaleSummary.subtotal)}`,
      ...wholesaleSummary.adjustments.map((item) => `*${item.label}:* ${formatCurrency(item.amount)}`),
      `*Total:* ${formatCurrency(wholesaleSummary.total)}`,
      '',
      'Wholesale pricing quote, subject to confirmation and flower availability.',
    ].join('\n')
  }, [customerName, wholesaleSummary])

  async function copyCustomerQuote() {
    try {
      await navigator.clipboard.writeText(customerQuoteText)
      window.alert('Customer quote copied to clipboard.')
    } catch {
      window.alert('Clipboard unavailable. Copy manually from the preview panel.')
    }
  }

  async function copyWholesaleQuote() {
    try {
      await navigator.clipboard.writeText(wholesaleQuoteText)
      window.alert('Wholesale quote copied to clipboard.')
    } catch {
      window.alert('Clipboard unavailable. Copy manually from the wholesale preview panel.')
    }
  }

  function updateStemCount(id, rawValue) {
    setCustomSelections((current) =>
      current.map((entry) => {
        if (entry.component.id !== id) return entry

        if (rawValue === '') {
          return { ...entry, inputValue: '', count: 0 }
        }

        const nextCount = Math.max(0, Number(rawValue) || 0)
        return { ...entry, inputValue: String(rawValue), count: nextCount }
      }),
    )
  }

  function bumpStemCount(id, delta) {
    setCustomSelections((current) =>
      current.map((entry) => {
        if (entry.component.id !== id) return entry
        const nextCount = Math.max(0, (entry.count || 0) + delta)
        return {
          ...entry,
          count: nextCount,
          inputValue: nextCount === 0 ? '' : String(nextCount),
        }
      }),
    )
  }

  useEffect(() => {
    setCustomSelections((current) =>
      current.map((entry) => (entry.component.prices?.[city] ? entry : { ...entry, count: 0, inputValue: '' })),
    )
  }, [city])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('bouquet-theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('bouquet-role', activeRole)
  }, [activeRole])

  return (
    <div className="app-shell">
      <header className="hero-card stack-gap compact">
        <div className="hero-header-row">
          <div>
            <p className="eyebrow">Internal MVP</p>
            <h1>Bloomfield bouquet calculator</h1>
            <p className="muted">Catalogue and custom quoting, centered on Lagos and Abuja pricing with Bloomfield sheet-backed custom flower rates.</p>
          </div>

          <div className="stack-gap compact" style={{ alignItems: 'flex-end' }}>
            <div className="theme-switcher" role="group" aria-label="Role switcher">
              {roleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`theme-chip ${activeRole === option.id ? 'theme-chip-active' : ''}`}
                  onClick={() => setActiveRole(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="theme-switcher" role="group" aria-label="Theme switcher">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`theme-chip ${theme === option.id ? 'theme-chip-active' : ''}`}
                  onClick={() => setTheme(option.id)}
                  title={option.label}
                  aria-label={option.label}
                >
                  <span aria-hidden="true">{option.icon}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="layout-grid">
        <section className="panel stack-gap">
          <div className="field-grid two-up three-up-lg">
            <label>
              <span>City</span>
              <select value={city} onChange={(event) => setCity(event.target.value)}>
                {cities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Quote type</span>
              <select value={quoteType} onChange={(event) => setQuoteType(event.target.value)}>
                {quoteTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Quantity</span>
              <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} />
            </label>
          </div>

          {quoteType === 'catalog' ? (
            <>
              <div className="field-grid two-up">
                <label>
                  <span>Catalogue bouquet</span>
                  <select value={selectedCatalogId} onChange={(event) => setSelectedCatalogId(event.target.value)}>
                    {catalogProducts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Range band when a bouquet uses sample fallback</span>
                  <select value={band} onChange={(event) => setBand(event.target.value)}>
                    {priceBandOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedCatalog && (() => {
                const resolved = resolveUnitPrice({ item: selectedCatalog, city, band, quantity })
                const status = getResolutionStatus(resolved, city)

                return (
                  <section className="catalog-grid">
                    <article className="catalog-card catalog-card-selected">
                      <img src={selectedCatalog.image} alt={selectedCatalog.name} className="catalog-image" />
                      <div className="stack-gap compact">
                        <div className="summary-row catalog-heading-row">
                          <div>
                            <h2>{selectedCatalog.name}</h2>
                            <p className="muted small">{selectedCatalog.sku}</p>
                          </div>
                          <strong>{formatCurrency(resolved.unitPrice)}</strong>
                        </div>
                        <p className="muted small">{selectedCatalog.description}</p>
                        <div className={`resolution-banner resolution-${status.tone}`}>
                          <strong>{status.label}</strong>
                          <p>{status.detail}</p>
                        </div>
                        <p className="muted small">{city === 'lagos' ? 'Lagos' : 'Abuja'} pricing • {resolved.selectionLabel}</p>
                      </div>
                    </article>
                  </section>
                )
              })()}

              {selectedCatalogPrice && selectedCatalogStatus && (
                <div className="schema-card stack-gap compact">
                  <div className="summary-row">
                    <div>
                      <strong>{selectedCatalog.sku}</strong>
                      <p className="muted small">{getCityLabel(city)} pricing</p>
                    </div>
                    <span>{selectedCatalogPrice.selectionLabel}</span>
                  </div>
                  <div className={`resolution-banner resolution-${selectedCatalogStatus.tone}`}>
                    <strong>{selectedCatalogStatus.label}</strong>
                    <p>{selectedCatalogStatus.detail}</p>
                  </div>
                  <p className="muted small">{selectedCatalog.description}</p>
                  <p className="muted small"><strong>Resolved unit price:</strong> {formatCurrency(selectedCatalogPrice.unitPrice)}</p>
                </div>
              )}
            </>
          ) : (
            <section className="stack-gap">
              <div>
                <h2>Custom bouquet builder</h2>
                <p className="muted">Add flower counts and see per-flower pricing live. Only flowers with a confirmed {getCityLabel(city)} sheet price can be quoted.</p>
              </div>
              <div className="stack-gap compact">
                {customSelections.map((entry) => {
                  const resolved = resolveUnitPrice({ item: entry.component, city, quantity: entry.count || 1 })
                  const isUnavailable = resolved.source === 'missing'
                  const status = isUnavailable
                    ? `No confirmed ${getCityLabel(city)} price yet`
                    : `${getCityLabel(city)} sheet price`

                  return (
                    <div key={entry.component.id} className="stem-row stem-card">
                      <div className="stem-copy">
                        <strong>{entry.component.name}</strong>
                        <p className="muted small">
                          {isUnavailable ? status : `${formatCurrency(resolved.unitPrice)} per ${entry.component.unit} • ${entry.component.sku}`}
                        </p>
                        <p className="muted small">{isUnavailable ? entry.component.sourceDetail : status}</p>
                      </div>
                      <div className="stem-controls">
                        <button type="button" className="step-button" disabled={isUnavailable} onClick={() => bumpStemCount(entry.component.id, -1)}>−</button>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          placeholder="0"
                          value={isUnavailable ? '' : entry.inputValue}
                          disabled={isUnavailable}
                          onChange={(event) => updateStemCount(entry.component.id, event.target.value)}
                        />
                        <button type="button" className="step-button" disabled={isUnavailable} onClick={() => bumpStemCount(entry.component.id, 1)}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

        </section>

        <aside className="panel summary-panel stack-gap">
          <div>
            <p className="eyebrow">Live summary</p>
            <h2>{summary.city} quote</h2>
            {quoteType === 'catalog' ? <p className="muted small">{getCityLabel(city)} quote, fallback band {getPriceBandLabel(band)}</p> : <p className="muted small">Custom bouquet pricing</p>}
          </div>

          <div className="summary-list stack-gap compact">
            {summary.lineItems.length ? (
              summary.lineItems.map((item) => {
                const status = item.metadata.usedFallback
                  ? 'Retail sample fallback'
                  : item.metadata.source === 'missing'
                    ? 'Price missing'
                    : `${getCityLabel(city)} price`

                return (
                  <div key={`${item.label}-${item.detail}`} className="summary-row">
                    <div>
                      <strong>{item.label}</strong>
                      <p className="muted small">{item.detail}</p>
                      <p className="muted small">{getPriceTypeLabel(item.metadata.pricingType)} • {status}</p>
                    </div>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                )
              })
            ) : (
              <p className="muted">Add a bouquet or flower counts to start the quote.</p>
            )}
          </div>

          <div className="totals stack-gap compact">
            <div className="summary-row"><span>Subtotal</span><strong>{formatCurrency(summary.subtotal)}</strong></div>
            {summary.adjustments.map((item) => (
              <div className="summary-row" key={item.label}>
                <span>{item.label}</span>
                <span>{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="summary-row total-row"><span>Total</span><strong>{formatCurrency(summary.total)}</strong></div>
          </div>

          <div className="stack-gap compact">
            <h3>Customer details</h3>
            <div className="field-grid two-up">
              <label>
                <span>Customer name</span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Chikezie" />
              </label>
              <label>
                <span>Recipient</span>
                <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Tosin" />
              </label>
            </div>
            <label>
              <span>Occasion</span>
              <input value={occasion} onChange={(event) => setOccasion(event.target.value)} placeholder="Birthday bouquet" />
            </label>
          </div>

          <div className="stack-gap compact">
            <h3>Adjustments</h3>
            <div className="field-grid two-up">
              <label>
                <span>Delivery</span>
                <select value={deliveryFee} onChange={(event) => setDeliveryFee(Number(event.target.value) || 0)}>
                  <option value="0">No delivery fee</option>
                  {deliveryOptions.map((amount) => (
                    <option key={`delivery-${amount}`} value={amount}>{formatCurrency(amount)}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Discount</span>
                <select value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value) || 0)}>
                  <option value="0">No discount</option>
                  {discountOptions.map((amount) => (
                    <option key={`discount-${amount}`} value={amount}>{formatPercentage(amount)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {summary.notes.length > 0 && (
            <div className="note-box">
              {summary.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}

          {activeRole === OPERATIONS_ROLE && (
            <>
              <button className="primary-button" onClick={copyQuote}>Copy Internal quote</button>
              <label>
                <span>Internal preview</span>
                <textarea readOnly value={quoteText} rows={14} />
              </label>

              <details className="details-panel" style={{ marginTop: '14px' }} open={showWholesaleQuote}>
                <summary onClick={(event) => {
                  event.preventDefault()
                  setShowWholesaleQuote((current) => !current)
                }}>
                  {showWholesaleQuote ? 'Hide wholesale quote tools' : 'Show wholesale quote tools'}
                </summary>
                <div className="stack-gap compact details-content">
                  <button className="primary-button" onClick={copyWholesaleQuote}>Copy Wholesale quote</button>
                  <label>
                    <span>Wholesale preview</span>
                    <textarea readOnly value={wholesaleQuoteText} rows={12} />
                  </label>
                </div>
              </details>
            </>
          )}

          <button className="primary-button" onClick={copyCustomerQuote} style={{ marginTop: '10px' }}>Copy Customer WhatsApp quote</button>
          <button className="primary-button" onClick={copyCustomerSendText} style={{ marginTop: '10px' }}>Copy Short customer send</button>

          <label>
            <span>Customer quote preview</span>
            <textarea readOnly value={customerQuoteText} rows={10} />
          </label>

          <label>
            <span>Short customer send preview</span>
            <textarea readOnly value={customerSendText} rows={6} />
          </label>
        </aside>
      </main>

      <section className="panel stack-gap source-footer">
        <div className="footer-header-row">
          <div>
            <p className="eyebrow">Internal references</p>
            <h2>Pricing confidence</h2>
            <p className="muted small">Cleaner by default, with source details tucked away unless someone needs to audit the quote logic.</p>
          </div>

          <div className="chip-row">
            {cities.map((item) => {
              const loadedCount = marketOverrideStatus[item.id]
              return (
                <span key={item.id} className="chip subtle-chip">
                  {item.label}: {loadedCount || 0} override{loadedCount === 1 ? '' : 's'}
                </span>
              )
            })}
          </div>
        </div>

        <details className="details-panel">
          <summary>Show technical source details</summary>
          <div className="stack-gap compact details-content">
            <div className="schema-card stack-gap compact">
              <p className="muted small code-inline">Catalog sample: /home/chizzy/.openclaw/workspace/bloomfield-flowers-site/src/main.js</p>
              <p className="muted small code-inline">Market overrides: src/data/sources/marketOverrides.import.json</p>
              <p className="muted small code-inline">Custom flower sheet: Bloomfield custom flower sheet</p>
            </div>

            <div className="stack-gap compact">
              {catalogProducts.map((product) => (
                <div key={product.id} className="schema-card stack-gap compact source-item-card">
                  <div className="summary-row">
                    <strong>{product.name}</strong>
                    <span className="muted small">{product.sku}</span>
                  </div>
                  <p className="muted small"><strong>Image:</strong> {product.imageSource}</p>
                </div>
              ))}
            </div>
          </div>
        </details>
      </section>
    </div>
  )
}

export default App
