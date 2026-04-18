import { useEffect, useMemo, useState } from 'react'
import { pricingCatalog } from './data/pricing'
import { marketOverrideStatus } from './data/sources/marketOverrides'
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
const initialCustomSelections = components.map((component) => ({ component, count: 0 }))
const deliveryOptions = Array.from({ length: 59 }, (_, index) => 1000 + (index * 500))
const discountOptions = [5, 10, 15, 20, 25, 30]
const themeOptions = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'night', label: 'Night' },
]

function App() {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('bouquet-theme') || 'light')
  const [city, setCity] = useState(cities[0].id)
  const [quoteType, setQuoteType] = useState(quoteTypes[0].id)
  const [selectedCatalogId, setSelectedCatalogId] = useState(catalogProducts[0].id)
  const [band, setBand] = useState('standard')
  const [quantity, setQuantity] = useState(1)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)
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

  const quoteText = useMemo(() => {
    const lines = [
      'Bloomfield Quote',
      `City: ${summary.city}`,
      `Type: ${quoteType === 'catalog' ? 'Catalog bouquet' : 'Custom bouquet'}`,
      '',
      ...summary.lineItems.map((item) => `• ${item.label}: ${item.detail} = ${formatCurrency(item.amount)}`),
      '',
      `Subtotal: ${formatCurrency(summary.subtotal)}`,
      ...summary.adjustments.map((item) => `${item.label}: ${formatCurrency(item.amount)}`),
      `Total: ${formatCurrency(summary.total)}`,
      'Valid for 24 hours subject to flower availability.',
    ]
    return lines.join('\n')
  }, [quoteType, summary])

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(quoteText)
      window.alert('Quote copied to clipboard.')
    } catch {
      window.alert('Clipboard unavailable. Copy manually from the preview panel.')
    }
  }

  function updateStemCount(id, count) {
    setCustomSelections((current) =>
      current.map((entry) => (entry.component.id === id ? { ...entry, count: Number(count) || 0 } : entry)),
    )
  }

  useEffect(() => {
    setCustomSelections((current) =>
      current.map((entry) => (entry.component.prices?.[city] ? entry : { ...entry, count: 0 })),
    )
  }, [city])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('bouquet-theme', theme)
  }, [theme])

  return (
    <div className="app-shell">
      <header className="hero-card stack-gap compact">
        <div className="hero-header-row">
          <div>
            <p className="eyebrow">Internal MVP</p>
            <h1>Bloomfield bouquet calculator</h1>
            <p className="muted">Catalogue and custom quoting, centered on Lagos and Abuja pricing with Bloomfield sheet-backed custom flower rates.</p>
          </div>

          <div className="theme-switcher" role="group" aria-label="Theme switcher">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`theme-chip ${theme === option.id ? 'theme-chip-active' : ''}`}
                onClick={() => setTheme(option.id)}
              >
                {option.label}
              </button>
            ))}
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
                      <div>
                        <strong>{entry.component.name}</strong>
                        <p className="muted small">
                          {isUnavailable ? status : `${formatCurrency(resolved.unitPrice)} per ${entry.component.unit} • ${entry.component.sku}`}
                        </p>
                        <p className="muted small">{isUnavailable ? entry.component.sourceDetail : status}</p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={isUnavailable ? 0 : entry.count}
                        disabled={isUnavailable}
                        onChange={(event) => updateStemCount(entry.component.id, event.target.value)}
                      />
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

          <button className="primary-button" onClick={copyQuote}>Copy customer quote</button>

          <label>
            <span>Preview text</span>
            <textarea readOnly value={quoteText} rows={14} />
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
