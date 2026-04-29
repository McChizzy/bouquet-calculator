import { useEffect, useMemo, useState } from 'react'

const SALES_ROLE = 'sales'
const OPERATIONS_ROLE = 'operations'

import { pricingCatalog } from './data/pricing'
import marketOverrideImport from './data/sources/marketOverrides.import.json'
import { bloomfieldMarketOverrides, marketOverrideImportTemplate } from './data/sources/marketOverrides'
import { bloomfieldRetailSamples } from './data/sources/bloomfieldRetailSamples'
import { customFlowerPrices } from './data/sources/customFlowerPrices'
import { customFlowerWholesalePrices } from './data/sources/customFlowerWholesalePrices'
import { mergeMarketPrices, normalizeProducts } from './data/adapters/pricingAdapter'
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

const { cities, priceBandOptions, quoteTypes } = pricingCatalog
const SAVED_QUOTES_STORAGE_KEY = 'bloomfield-saved-quotes'
const MARKET_OVERRIDE_DRAFT_STORAGE_KEY = 'bloomfield-market-override-draft'
const CUSTOM_PRICES_DRAFT_STORAGE_KEY = 'bloomfield-custom-prices-draft'
const ADMIN_LAST_APPLIED_STORAGE_KEY = 'bloomfield-admin-last-applied'
const deliveryOptions = Array.from({ length: 59 }, (_, index) => 1000 + (index * 500))
const discountOptions = [5, 10, 15, 20, 25, 30]
const validityOptions = [
  { id: '24h', label: '24 hours', note: 'Valid for 24 hours, subject to flower availability.' },
  { id: '48h', label: '48 hours', note: 'Valid for 48 hours, subject to flower availability.' },
  { id: 'custom', label: 'Custom note', note: '' },
]
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

function getDefaultCatalogId() {
  return bloomfieldRetailSamples[0]?.sku?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'catalog-item'
}

function createEmptyCustomSelections(components) {
  return components.map((component) => ({ component, count: 0, inputValue: '' }))
}

function createQuoteId() {
  return `BFF-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`
}

function getValidityNote(validityPreset, customValidityNote) {
  if (validityPreset === 'custom') {
    return customValidityNote.trim() || 'Validity note pending confirmation.'
  }

  return validityOptions.find((option) => option.id === validityPreset)?.note || validityOptions[0].note
}

function getSavedQuotes() {
  try {
    const raw = window.localStorage.getItem(SAVED_QUOTES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistSavedQuotes(quotes) {
  window.localStorage.setItem(SAVED_QUOTES_STORAGE_KEY, JSON.stringify(quotes))
}

function getStoredText(key, fallback) {
  return window.localStorage.getItem(key) || fallback
}

function getInitialMarketOverrideDraft() {
  return getStoredText(MARKET_OVERRIDE_DRAFT_STORAGE_KEY, JSON.stringify(marketOverrideImport, null, 2))
}

function getInitialCustomPricesDraft() {
  return getStoredText(CUSTOM_PRICES_DRAFT_STORAGE_KEY, JSON.stringify(customFlowerPrices, null, 2))
}

function getInitialAdminLastApplied() {
  return window.localStorage.getItem(ADMIN_LAST_APPLIED_STORAGE_KEY) || ''
}

function downloadJson(filename, content) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

function getCustomSelectionCount(customSelections) {
  return customSelections.reduce((sum, item) => sum + item.count, 0)
}

function getCustomLineCount(customSelections) {
  return customSelections.filter((item) => item.count > 0).length
}

function getProductLabel({ quoteType, selectedCatalog, customSelections }) {
  if (quoteType === 'catalog' && selectedCatalog) return selectedCatalog.name

  const nonZeroItems = customSelections.filter((selection) => selection.count > 0)
  if (nonZeroItems.length === 0) return 'Custom bouquet'
  if (nonZeroItems.length === 1) return `${nonZeroItems[0].component.name} custom bouquet`
  if (nonZeroItems.length === 2) return `${nonZeroItems[0].component.name} and ${nonZeroItems[1].component.name} custom bouquet`

  return `${nonZeroItems[0].component.name}, ${nonZeroItems[1].component.name}, and more custom bouquet`
}

function getQuoteStatus({ summary, manualOverrideEnabled, manualOverrideReason, manualOverrideValid }) {
  if (summary.lineItems.length === 0) {
    return {
      tone: 'neutral',
      label: 'Draft quote',
      detail: 'Add a bouquet or flower counts to generate a send-ready quote.',
    }
  }

  if (manualOverrideEnabled) {
    return manualOverrideValid && manualOverrideReason.trim()
      ? {
          tone: 'warning',
          label: 'Manual override applied',
          detail: 'The final total was manually adjusted. Keep the reason with the quote.',
        }
      : {
          tone: 'danger',
          label: 'Manual override needs review',
          detail: 'Add a valid override total and short reason before sending.',
        }
  }

  if (summary.lineItems.some((item) => item.metadata.usedFallback)) {
    return {
      tone: 'warning',
      label: 'Fallback pricing in use',
      detail: 'This quote uses retail sample fallback pricing for at least one item.',
    }
  }

  return {
    tone: 'success',
    label: 'Confirmed pricing',
    detail: 'All selected line items use loaded city pricing.',
  }
}

function isValidPriceShape(price) {
  if (!price || typeof price !== 'object' || !price.type) return false
  if (price.type === 'fixed') return Number.isFinite(Number(price.amount))
  if (price.type === 'range') return Number.isFinite(Number(price.min)) && Number.isFinite(Number(price.max))
  if (price.type === 'tiered') return Array.isArray(price.tiers) && price.tiers.length > 0
  if (price.type === 'custom') return true
  return false
}

function validateMarketOverrideDraft(parsed) {
  const errors = []
  const warnings = []
  const seen = new Set()

  for (const market of ['lagos', 'abuja']) {
    const rows = Array.isArray(parsed?.[market]) ? parsed[market] : []
    rows.forEach((row, index) => {
      const rowLabel = `${market} row ${index + 1}`
      if (!row?.sku) {
        errors.push(`${rowLabel}: missing sku.`)
        return
      }

      const price = row.prices?.[market] || row.price
      if (!price) {
        errors.push(`${rowLabel} (${row.sku}): missing ${market} price.`)
      } else if (!isValidPriceShape(price)) {
        errors.push(`${rowLabel} (${row.sku}): invalid price shape.`)
      }

      const duplicateKey = `${market}:${row.sku}`
      if (seen.has(duplicateKey)) {
        warnings.push(`${rowLabel} (${row.sku}): duplicate SKU for ${market}; last applied row wins.`)
      }
      seen.add(duplicateKey)
    })
  }

  return { errors, warnings }
}

function validateCustomPriceDraft(parsed) {
  const errors = []
  const warnings = []
  const seen = new Set()

  if (!Array.isArray(parsed)) {
    errors.push('Custom flower price draft must be a JSON array.')
    return { errors, warnings }
  }

  parsed.forEach((row, index) => {
    const rowLabel = `custom row ${index + 1}`
    if (!row?.id) errors.push(`${rowLabel}: missing id.`)
    if (!row?.sku) errors.push(`${rowLabel}: missing sku.`)
    if (!row?.name) errors.push(`${rowLabel}: missing name.`)

    const hasAnyPrice = ['lagos', 'abuja'].some((market) => row?.prices?.[market])
    if (!hasAnyPrice) {
      errors.push(`${rowLabel} (${row?.name || row?.sku || 'unknown'}): missing both Lagos and Abuja prices.`)
    }

    for (const market of ['lagos', 'abuja']) {
      if (row?.prices?.[market] && !isValidPriceShape(row.prices[market])) {
        errors.push(`${rowLabel} (${row?.sku || 'unknown'}): invalid ${market} price shape.`)
      }
    }

    const duplicateKey = row?.sku || row?.id || `${index}`
    if (seen.has(duplicateKey)) {
      warnings.push(`${rowLabel} (${duplicateKey}): duplicate SKU/id found; later row may overwrite operator expectations.`)
    }
    seen.add(duplicateKey)
  })

  return { errors, warnings }
}

function App() {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('bouquet-theme') || 'light')
  const [activeRole, setActiveRole] = useState(() => window.localStorage.getItem('bouquet-role') || OPERATIONS_ROLE)
  const [marketOverrideDraft, setMarketOverrideDraft] = useState(() => getInitialMarketOverrideDraft())
  const [customPricesDraft, setCustomPricesDraft] = useState(() => getInitialCustomPricesDraft())
  const [runtimeMarketOverrides, setRuntimeMarketOverrides] = useState(() => bloomfieldMarketOverrides)
  const [runtimeComponents, setRuntimeComponents] = useState(() => normalizeProducts(customFlowerPrices))
  const [adminFeedback, setAdminFeedback] = useState('')
  const [adminValidation, setAdminValidation] = useState({ errors: [], warnings: [] })
  const [adminLastAppliedAt, setAdminLastAppliedAt] = useState(() => getInitialAdminLastApplied())
  const [quoteId, setQuoteId] = useState(() => createQuoteId())
  const [city, setCity] = useState(cities[0].id)
  const [quoteType, setQuoteType] = useState('custom')
  const [selectedCatalogId, setSelectedCatalogId] = useState(() => getDefaultCatalogId())
  const [band, setBand] = useState('standard')
  const [quantity, setQuantity] = useState(1)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [validityPreset, setValidityPreset] = useState('24h')
  const [customValidityNote, setCustomValidityNote] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [occasion, setOccasion] = useState('')
  const [showWholesaleQuote, setShowWholesaleQuote] = useState(false)
  const [manualOverrideEnabled, setManualOverrideEnabled] = useState(false)
  const [manualOverrideTotal, setManualOverrideTotal] = useState('')
  const [manualOverrideReason, setManualOverrideReason] = useState('')
  const [savedQuotes, setSavedQuotes] = useState(() => getSavedQuotes())

  const catalogProducts = useMemo(
    () => mergeMarketPrices(bloomfieldRetailSamples, runtimeMarketOverrides),
    [runtimeMarketOverrides],
  )
  const components = useMemo(() => normalizeProducts(runtimeComponents), [runtimeComponents])
  const marketOverrideStatus = useMemo(
    () => ({
      lagos: runtimeMarketOverrides?.lagos?.products?.length || 0,
      abuja: runtimeMarketOverrides?.abuja?.products?.length || 0,
    }),
    [runtimeMarketOverrides],
  )

  const [customSelections, setCustomSelections] = useState(() => createEmptyCustomSelections(normalizeProducts(customFlowerPrices)))

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

  const manualOverrideValue = Number(manualOverrideTotal)
  const manualOverrideValid = manualOverrideEnabled && Number.isFinite(manualOverrideValue) && manualOverrideValue >= 0
  const effectiveTotal = manualOverrideValid ? manualOverrideValue : summary.total
  const manualOverrideDelta = manualOverrideValid ? manualOverrideValue - summary.total : 0
  const effectiveAdjustments = manualOverrideValid
    ? [...summary.adjustments, { label: 'Manual override', amount: manualOverrideDelta }]
    : summary.adjustments

  const effectiveNotes = [
    ...summary.notes,
    ...(manualOverrideEnabled && !manualOverrideValid ? ['Manual override total must be a valid amount.'] : []),
    ...(manualOverrideEnabled && manualOverrideValid && !manualOverrideReason.trim() ? ['Manual override reason is required for audit clarity.'] : []),
    ...(manualOverrideEnabled && manualOverrideValid && manualOverrideReason.trim() ? [`Manual override reason: ${manualOverrideReason.trim()}`] : []),
  ]

  const quoteStatus = useMemo(
    () => getQuoteStatus({ summary, manualOverrideEnabled, manualOverrideReason, manualOverrideValid }),
    [summary, manualOverrideEnabled, manualOverrideReason, manualOverrideValid],
  )

  const selectedCustomStemCount = getCustomSelectionCount(customSelections)
  const selectedCustomLineCount = getCustomLineCount(customSelections)
  const productLabel = getProductLabel({ quoteType, selectedCatalog, customSelections })
  const validityNote = getValidityNote(validityPreset, customValidityNote)
  const selectedCustomItems = customSelections.filter((entry) => entry.count > 0)
  const unavailableCustomItems = customSelections.filter((entry) => !entry.component.prices?.[city])

  const customerSendText = useMemo(() => {
    const lines = [
      customerName ? `Hi ${customerName},` : 'Hi,',
      `Your ${getCityLabel(city)} bouquet quote is ${formatCurrency(effectiveTotal)}.`,
      occasion ? `Occasion: ${occasion}` : null,
      recipientName ? `Recipient: ${recipientName}` : null,
      'Reply here to confirm and we’ll finalize delivery details.',
      'Bloomfield Flowers 💐',
    ].filter(Boolean)

    return lines.join('\n')
  }, [city, customerName, effectiveTotal, occasion, recipientName])

  const quoteText = useMemo(() => {
    const introLines = [
      '🌸 *Bloomfield Flowers Internal Quote*',
      `*Quote ID:* ${quoteId}`,
      customerName ? `Hello ${customerName},` : 'Hello,',
      '',
      `*City:* ${summary.city}`,
      `*Type:* ${quoteType === 'catalog' ? 'Catalog bouquet' : 'Custom bouquet'}`,
      `*Product:* ${productLabel}`,
      `*Status:* ${quoteStatus.label}`,
      recipientName ? `*Recipient:* ${recipientName}` : null,
      occasion ? `*Occasion:* ${occasion}` : null,
    ].filter(Boolean)

    const itemLines = summary.lineItems.length
      ? summary.lineItems.map((item) => `• ${item.label} (${item.detail}) — ${formatCurrency(item.amount)}`)
      : ['• No quote items selected yet.']

    const totalLines = [
      '',
      `*Subtotal:* ${formatCurrency(summary.subtotal)}`,
      ...effectiveAdjustments.map((item) => `*${item.label}:* ${formatCurrency(item.amount)}`),
      `*Final total:* ${formatCurrency(effectiveTotal)}`,
      ...(manualOverrideEnabled && manualOverrideReason.trim() ? [`*Override reason:* ${manualOverrideReason.trim()}`] : []),
      '',
      validityNote,
      'Thank you for choosing Bloomfield Flowers 💐',
    ]

    return [...introLines, '', ...itemLines, ...totalLines].join('\n')
  }, [
    customerName,
    effectiveAdjustments,
    effectiveTotal,
    manualOverrideEnabled,
    manualOverrideReason,
    occasion,
    validityNote,
    productLabel,
    quoteId,
    quoteStatus.label,
    quoteType,
    recipientName,
    summary,
  ])

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

  const customerQuotePreviewText = useMemo(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    const itemLines = quoteType === 'custom'
      ? selectedCustomItems.length > 0
        ? selectedCustomItems.map((entry) => {
            const resolved = resolveUnitPrice({ item: entry.component, city, quantity: entry.count })
            return `• ${entry.component.name} x ${entry.count} — ${formatCurrency(resolved.unitPrice * entry.count)}`
          })
        : ['• Final bouquet details will be confirmed before checkout.']
      : summary.lineItems.length
        ? summary.lineItems.map((item) => `• ${item.label} — ${formatCurrency(item.amount)}`)
        : ['• Final bouquet details will be confirmed before checkout.']

    return [
      '*Bloomfield Flowers Quote Preview*',
      `Quote ID: ${quoteId}`,
      `Date: ${dateStr}`,
      customerName ? `Hello ${customerName},` : 'Hello,',
      '',
      `*City:* ${summary.city}`,
      `*Bouquet:* ${productLabel}`,
      recipientName ? `*Recipient:* ${recipientName}` : null,
      occasion ? `*Occasion:* ${occasion}` : null,
      '',
      '*Quote details*',
      ...itemLines,
      '',
      `*Subtotal:* ${formatCurrency(summary.subtotal)}`,
      ...effectiveAdjustments.map((item) => `*${item.label}:* ${formatCurrency(item.amount)}`),
      `*Total payable:* ${formatCurrency(effectiveTotal)}`,
      '',
      validityNote,
      'Reply to confirm and we’ll finalize delivery details.',
      'Bloomfield Flowers 💐',
    ].filter(Boolean).join('\n')
  }, [
    city,
    customerName,
    effectiveAdjustments,
    effectiveTotal,
    occasion,
    productLabel,
    quoteType,
    selectedCustomItems,
    validityNote,
    quoteId,
    recipientName,
    summary,
  ])

  const customerQuoteCopyText = useMemo(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    const itemLines = quoteType === 'custom'
      ? selectedCustomItems.length > 0
        ? selectedCustomItems.map((entry) => `• ${entry.component.name} x ${entry.count}`)
        : ['• Final bouquet details will be confirmed before checkout.']
      : summary.lineItems.length
        ? summary.lineItems.map((item) => `• ${item.label}`)
        : ['• Final bouquet details will be confirmed before checkout.']

    return [
      '*Bloomfield Flowers Quote*',
      `Quote ID: ${quoteId}`,
      `Date: ${dateStr}`,
      customerName ? `Hello ${customerName},` : 'Hello,',
      '',
      `*City:* ${summary.city}`,
      `*Bouquet:* ${productLabel}`,
      recipientName ? `*Recipient:* ${recipientName}` : null,
      occasion ? `*Occasion:* ${occasion}` : null,
      '',
      '*Quote details*',
      ...itemLines,
      '',
      validityNote,
      'Reply to confirm and we’ll finalize delivery details.',
      'Bloomfield Flowers 💐',
    ].filter(Boolean).join('\n')
  }, [
    customerName,
    occasion,
    productLabel,
    quoteType,
    selectedCustomItems,
    validityNote,
    quoteId,
    recipientName,
    summary,
  ])

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

  async function copyCustomerQuote() {
    try {
      await navigator.clipboard.writeText(customerQuoteCopyText)
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

  function markAdminApplied() {
    const timestamp = new Date().toISOString()
    setAdminLastAppliedAt(timestamp)
    window.localStorage.setItem(ADMIN_LAST_APPLIED_STORAGE_KEY, timestamp)
  }

  async function importDraftFile(type, event) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      if (type === 'market') {
        setMarketOverrideDraft(text)
        setAdminFeedback(`Loaded market override file: ${file.name}`)
      } else {
        setCustomPricesDraft(text)
        setAdminFeedback(`Loaded custom prices file: ${file.name}`)
      }
      setAdminValidation({ errors: [], warnings: [] })
    } catch {
      setAdminFeedback(`Could not read ${file.name}. Try another JSON file.`)
    } finally {
      event.target.value = ''
    }
  }

  function exportMarketOverrideDraft() {
    downloadJson('bloomfield-market-overrides.json', marketOverrideDraft)
    setAdminFeedback('Exported market override draft JSON.')
  }

  function exportCustomPricesDraft() {
    downloadJson('bloomfield-custom-flower-prices.json', customPricesDraft)
    setAdminFeedback('Exported custom flower prices draft JSON.')
  }

  function applyMarketOverrideDraft() {
    try {
      const parsed = JSON.parse(marketOverrideDraft)
      const validation = validateMarketOverrideDraft(parsed)
      setAdminValidation(validation)

      if (validation.errors.length > 0) {
        setAdminFeedback('Market override draft has validation errors. Fix them before applying.')
        return
      }

      const nextOverrides = {
        lagos: {
          source: 'Local admin import',
          products: Array.isArray(parsed.lagos)
            ? parsed.lagos
                .filter((record) => record?.sku && (record?.price || record?.prices?.lagos))
                .map((record) => ({ sku: record.sku, prices: { lagos: record.prices?.lagos || record.price } }))
            : [],
        },
        abuja: {
          source: 'Local admin import',
          products: Array.isArray(parsed.abuja)
            ? parsed.abuja
                .filter((record) => record?.sku && (record?.price || record?.prices?.abuja))
                .map((record) => ({ sku: record.sku, prices: { abuja: record.prices?.abuja || record.price } }))
            : [],
        },
      }

      setRuntimeMarketOverrides(nextOverrides)
      window.localStorage.setItem(MARKET_OVERRIDE_DRAFT_STORAGE_KEY, marketOverrideDraft)
      markAdminApplied()
      setAdminFeedback(validation.warnings.length > 0 ? 'Market override draft applied locally with warnings.' : 'Market override draft applied locally.')
    } catch {
      setAdminValidation({ errors: ['Market override JSON could not be parsed.'], warnings: [] })
      setAdminFeedback('Market override JSON is invalid. Fix the draft before applying.')
    }
  }

  function applyCustomPricesDraft() {
    try {
      const parsed = JSON.parse(customPricesDraft)
      const validation = validateCustomPriceDraft(parsed)
      setAdminValidation(validation)

      if (validation.errors.length > 0) {
        setAdminFeedback('Custom flower price draft has validation errors. Fix them before applying.')
        return
      }

      const nextComponents = normalizeProducts(parsed)
      setRuntimeComponents(nextComponents)
      setCustomSelections(createEmptyCustomSelections(nextComponents))
      window.localStorage.setItem(CUSTOM_PRICES_DRAFT_STORAGE_KEY, customPricesDraft)
      markAdminApplied()
      setAdminFeedback(validation.warnings.length > 0 ? 'Custom flower price draft applied locally with warnings.' : 'Custom flower price draft applied locally.')
    } catch {
      setAdminValidation({ errors: ['Custom flower price JSON could not be parsed.'], warnings: [] })
      setAdminFeedback('Custom flower price JSON is invalid. Fix the draft before applying.')
    }
  }

  function resetAdminDrafts() {
    const defaultOverrideDraft = JSON.stringify(marketOverrideImport, null, 2)
    const defaultCustomDraft = JSON.stringify(customFlowerPrices, null, 2)
    setMarketOverrideDraft(defaultOverrideDraft)
    setCustomPricesDraft(defaultCustomDraft)
    setRuntimeMarketOverrides(bloomfieldMarketOverrides)
    const normalizedDefaults = normalizeProducts(customFlowerPrices)
    setRuntimeComponents(normalizedDefaults)
    setCustomSelections(createEmptyCustomSelections(normalizedDefaults))
    window.localStorage.removeItem(MARKET_OVERRIDE_DRAFT_STORAGE_KEY)
    window.localStorage.removeItem(CUSTOM_PRICES_DRAFT_STORAGE_KEY)
    window.localStorage.removeItem(ADMIN_LAST_APPLIED_STORAGE_KEY)
    setAdminLastAppliedAt('')
    setAdminValidation({ errors: [], warnings: [] })
    setAdminFeedback('Admin drafts reset to project defaults.')
  }

  function saveCurrentQuote() {
    const savedQuote = {
      id: quoteId,
      createdAt: new Date().toISOString(),
      city,
      quoteType,
      selectedCatalogId,
      band,
      quantity,
      deliveryFee,
      discountPercent,
      validityPreset,
      customValidityNote,
      customerName,
      recipientName,
      occasion,
      manualOverrideEnabled,
      manualOverrideTotal,
      manualOverrideReason,
      customSelections: customSelections.map((entry) => ({
        componentId: entry.component.id,
        count: entry.count,
      })),
      previewLabel: productLabel,
      previewTotal: effectiveTotal,
    }

    const nextQuotes = [savedQuote, ...savedQuotes.filter((item) => item.id !== quoteId)].slice(0, 20)
    setSavedQuotes(nextQuotes)
    persistSavedQuotes(nextQuotes)
    window.alert('Quote saved locally.')
  }

  function loadSavedQuote(savedQuote) {
    const savedCounts = new Map((savedQuote.customSelections || []).map((item) => [item.componentId, item.count]))

    setQuoteId(savedQuote.id || createQuoteId())
    setCity(savedQuote.city || cities[0].id)
    setQuoteType(savedQuote.quoteType || 'custom')
    setSelectedCatalogId(savedQuote.selectedCatalogId || catalogProducts[0]?.id || getDefaultCatalogId())
    setBand(savedQuote.band || 'standard')
    setQuantity(savedQuote.quantity || 1)
    setDeliveryFee(savedQuote.deliveryFee || 0)
    setDiscountPercent(savedQuote.discountPercent || 0)
    setValidityPreset(savedQuote.validityPreset || '24h')
    setCustomValidityNote(savedQuote.customValidityNote || '')
    setCustomerName(savedQuote.customerName || '')
    setRecipientName(savedQuote.recipientName || '')
    setOccasion(savedQuote.occasion || '')
    setShowWholesaleQuote(false)
    setManualOverrideEnabled(Boolean(savedQuote.manualOverrideEnabled))
    setManualOverrideTotal(savedQuote.manualOverrideTotal || '')
    setManualOverrideReason(savedQuote.manualOverrideReason || '')
    setCustomSelections(
      createEmptyCustomSelections(components).map((entry) => {
        const nextCount = savedCounts.get(entry.component.id) || 0
        return {
          ...entry,
          count: nextCount,
          inputValue: nextCount > 0 ? String(nextCount) : '',
        }
      }),
    )
  }

  function deleteSavedQuote(id) {
    const nextQuotes = savedQuotes.filter((item) => item.id !== id)
    setSavedQuotes(nextQuotes)
    persistSavedQuotes(nextQuotes)
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

  function clearCustomSelections() {
    setCustomSelections((current) => current.map((entry) => ({ ...entry, count: 0, inputValue: '' })))
  }

  function resetQuote() {
    setQuoteId(createQuoteId())
    setCity(cities[0].id)
    setQuoteType('custom')
    setSelectedCatalogId(catalogProducts[0]?.id || getDefaultCatalogId())
    setBand('standard')
    setQuantity(1)
    setDeliveryFee(0)
    setDiscountPercent(0)
    setValidityPreset('24h')
    setCustomValidityNote('')
    setCustomerName('')
    setRecipientName('')
    setOccasion('')
    setShowWholesaleQuote(false)
    setManualOverrideEnabled(false)
    setManualOverrideTotal('')
    setManualOverrideReason('')
    setCustomSelections(createEmptyCustomSelections(components))
  }

  useEffect(() => {
    setCustomSelections((current) =>
      current.map((entry) => (entry.component.prices?.[city] ? entry : { ...entry, count: 0, inputValue: '' })),
    )
  }, [city])

  useEffect(() => {
    setCustomSelections((current) =>
      components.map((component) => {
        const existing = current.find((entry) => entry.component.id === component.id)
        if (!existing) return { component, count: 0, inputValue: '' }
        return {
          ...existing,
          component,
        }
      }),
    )
  }, [components])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('bouquet-theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('bouquet-role', activeRole)
  }, [activeRole])

  useEffect(() => {
    window.localStorage.setItem(MARKET_OVERRIDE_DRAFT_STORAGE_KEY, marketOverrideDraft)
  }, [marketOverrideDraft])

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_PRICES_DRAFT_STORAGE_KEY, customPricesDraft)
  }, [customPricesDraft])

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

        <div className="hero-meta-row">
          <div className={`status-banner status-${quoteStatus.tone}`}>
            <strong>{quoteStatus.label}</strong>
            <p>{quoteStatus.detail}</p>
          </div>
          <div className="button-row hero-actions">
            <button type="button" className="secondary-button" onClick={saveCurrentQuote}>Save quote</button>
            <button type="button" className="secondary-button" onClick={resetQuote}>Start new quote</button>
          </div>
        </div>

        {savedQuotes.length > 0 && (
          <section className="panel stack-gap compact" style={{ marginTop: '12px' }}>
            <div className="section-heading compact-heading">
              <p className="eyebrow">Recent quotes</p>
              <h2>Saved locally</h2>
              <p className="muted small">Reopen recent quotes without rebuilding them from scratch.</p>
            </div>
            <div className="stack-gap compact">
              {savedQuotes.slice(0, 5).map((item) => (
                <div key={item.id} className="schema-card stack-gap compact">
                  <div className="summary-row">
                    <strong>{item.previewLabel || 'Saved quote'}</strong>
                    <span>{formatCurrency(item.previewTotal || 0)}</span>
                  </div>
                  <p className="muted small">{getCityLabel(item.city || 'lagos')} • {item.quoteType === 'catalog' ? 'Catalog' : 'Custom'} • {item.id}</p>
                  <div className="button-row">
                    <button type="button" className="secondary-button" onClick={() => loadSavedQuote(item)}>Open</button>
                    <button type="button" className="secondary-button" onClick={() => deleteSavedQuote(item.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="step-grid" aria-label="Quote workflow overview">
          <div className="step-card step-card-active">
            <span className="step-number">1</span>
            <div>
              <strong>Choose market</strong>
              <p className="muted small">{getCityLabel(city)} pricing selected</p>
            </div>
          </div>
          <div className="step-card step-card-active">
            <span className="step-number">2</span>
            <div>
              <strong>Pick quote path</strong>
              <p className="muted small">{quoteType === 'catalog' ? 'Catalog bouquet quote' : 'Custom bouquet quote'}</p>
            </div>
          </div>
          <div className={`step-card ${summary.lineItems.length > 0 ? 'step-card-active' : ''}`}>
            <span className="step-number">3</span>
            <div>
              <strong>Build the quote</strong>
              <p className="muted small">
                {quoteType === 'catalog'
                  ? selectedCatalog
                    ? `${selectedCatalog.name} x ${quantity}`
                    : 'Select a bouquet'
                  : selectedCustomLineCount > 0
                    ? `${selectedCustomLineCount} flower type${selectedCustomLineCount === 1 ? '' : 's'} • ${selectedCustomStemCount} stems`
                    : 'Add flowers and quantities'}
              </p>
            </div>
          </div>
          <div className={`step-card ${summary.lineItems.length > 0 ? 'step-card-active' : ''}`}>
            <span className="step-number">4</span>
            <div>
              <strong>Review and send</strong>
              <p className="muted small">Quote ID {quoteId}</p>
            </div>
          </div>
        </section>
      </header>

      <main className="layout-grid">
        <section className="panel stack-gap">
          <div className="section-heading">
            <p className="eyebrow">Step 1</p>
            <h2>Set quote basics</h2>
            <p className="muted small">Choose the market, quote path, and quantity before you start pricing.</p>
          </div>

          <div className="field-grid two-up three-up-lg quote-basics-grid">
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
              <div className="section-heading compact-heading">
                <p className="eyebrow">Step 2</p>
                <h2>Choose a catalogue bouquet</h2>
                <p className="muted small">Use confirmed Lagos or Abuja overrides when available, otherwise fall back to sample retail ranges.</p>
              </div>

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
              <div className="section-heading compact-heading">
                <p className="eyebrow">Step 2</p>
                <h2>Build a custom bouquet</h2>
                <p className="muted">Add flower counts and see per-flower pricing live. Only flowers with a confirmed {getCityLabel(city)} sheet price can be quoted.</p>
              </div>

              <div className="builder-toolbar">
                <p className="muted small">
                  {selectedCustomLineCount > 0
                    ? `${selectedCustomLineCount} flower type${selectedCustomLineCount === 1 ? '' : 's'} selected • ${selectedCustomStemCount} stem${selectedCustomStemCount === 1 ? '' : 's'}`
                    : `Select flowers for the ${getCityLabel(city)} quote.`}
                </p>
                <button type="button" className="secondary-button compact-button" onClick={clearCustomSelections}>Clear flower counts</button>
              </div>

              <div className="stack-gap compact">
                {customSelections.map((entry) => {
                  const resolved = resolveUnitPrice({ item: entry.component, city, quantity: entry.count || 1 })
                  const isUnavailable = resolved.source === 'missing'
                  const status = isUnavailable
                    ? `No confirmed ${getCityLabel(city)} price yet`
                    : `${getCityLabel(city)} sheet price`

                  return (
                    <div key={entry.component.id} className={`stem-row stem-card ${isUnavailable ? 'stem-card-disabled' : ''}`}>
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
            <p className="eyebrow">Step 3</p>
            <h2>{summary.city} quote</h2>
            <p className="muted small">{quoteType === 'catalog' ? `${getCityLabel(city)} quote, fallback band ${getPriceBandLabel(band)}` : 'Custom bouquet pricing'}</p>
          </div>

          <div className={`status-banner status-${quoteStatus.tone}`}>
            <strong>{quoteStatus.label}</strong>
            <p>{quoteStatus.detail}</p>
          </div>

          {quoteType === 'custom' && (
            <div className="schema-card stack-gap compact">
              <div className="summary-row">
                <strong>Composition summary</strong>
                <span>{selectedCustomStemCount} stems</span>
              </div>
              {selectedCustomItems.length > 0 ? (
                <div className="composition-list">
                  {selectedCustomItems.map((entry) => (
                    <div key={`summary-${entry.component.id}`} className="composition-item">
                      <span>{entry.component.name}</span>
                      <strong>{entry.count}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">No custom flower counts added yet.</p>
              )}
            </div>
          )}

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
            {effectiveAdjustments.map((item) => (
              <div className="summary-row" key={item.label}>
                <span>{item.label}</span>
                <span>{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="summary-row total-row"><span>Final total</span><strong>{formatCurrency(effectiveTotal)}</strong></div>
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
                <span>Quote validity</span>
                <select value={validityPreset} onChange={(event) => setValidityPreset(event.target.value)}>
                  {validityOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Delivery</span>
                <select value={deliveryFee} onChange={(event) => setDeliveryFee(Number(event.target.value) || 0)}>
                  <option value="0">No delivery fee</option>
                  {deliveryOptions.map((amount) => (
                    <option key={`delivery-${amount}`} value={amount}>{formatCurrency(amount)}</option>
                  ))}
                </select>
              </label>
            </div>
            {validityPreset === 'custom' && (
              <label>
                <span>Custom validity note</span>
                <input
                  value={customValidityNote}
                  onChange={(event) => setCustomValidityNote(event.target.value)}
                  placeholder="Valid until 6pm today, subject to flower availability."
                />
              </label>
            )}
            <div className="field-grid two-up">
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
            <p className="muted small">{validityNote}</p>
          </div>

          <div className="stack-gap compact">
            <h3>Manual override</h3>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={manualOverrideEnabled}
                onChange={(event) => setManualOverrideEnabled(event.target.checked)}
              />
              <span>Override the final total</span>
            </label>

            {manualOverrideEnabled && (
              <div className="stack-gap compact">
                <div className="field-grid two-up">
                  <label>
                    <span>Override total</span>
                    <input
                      type="number"
                      min="0"
                      value={manualOverrideTotal}
                      onChange={(event) => setManualOverrideTotal(event.target.value)}
                      placeholder="95000"
                    />
                  </label>
                  <label>
                    <span>Difference vs computed total</span>
                    <input readOnly value={manualOverrideValid ? formatCurrency(manualOverrideDelta) : 'Enter a valid override total'} />
                  </label>
                </div>
                <label>
                  <span>Reason for override</span>
                  <textarea
                    rows={3}
                    value={manualOverrideReason}
                    onChange={(event) => setManualOverrideReason(event.target.value)}
                    placeholder="Urgent order, negotiated customer rate, premium wrapping handled offline..."
                  />
                </label>
              </div>
            )}
          </div>

          {effectiveNotes.length > 0 && (
            <div className="note-box">
              {effectiveNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}

          {activeRole === OPERATIONS_ROLE && (
            <>
              <div className="section-heading compact-heading">
                <p className="eyebrow">Step 4</p>
                <h3>Internal preview and share</h3>
                <p className="muted small">Use the internal quote first for audit detail, then send the customer-ready WhatsApp version.</p>
              </div>

              <button className="primary-button" onClick={copyQuote}>Copy Internal quote</button>
              <label>
                <span>Internal preview</span>
                <textarea readOnly value={quoteText} rows={16} />
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

          <button className="primary-button" onClick={copyCustomerQuote}>Copy Customer WhatsApp quote</button>
          <button className="secondary-button" onClick={copyCustomerSendText}>Copy Short customer send</button>

          <label>
            <span>Customer quote preview</span>
            <textarea readOnly value={customerQuotePreviewText} rows={14} />
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
          <summary>Show admin pricing tools</summary>
          <div className="stack-gap compact details-content">
            <div className="schema-card stack-gap compact">
              <div className="summary-row">
                <strong>Local pricing manager</strong>
                <span className="muted small">Internal only</span>
              </div>
              <p className="muted small">Paste confirmed JSON, apply it locally, and keep quoting without editing source files directly.</p>
              {adminLastAppliedAt ? <p className="muted small">Last applied: {new Date(adminLastAppliedAt).toLocaleString('en-NG')}</p> : null}
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

            <label>
              <span>Market override draft JSON</span>
              <textarea value={marketOverrideDraft} onChange={(event) => setMarketOverrideDraft(event.target.value)} rows={12} />
            </label>
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={applyMarketOverrideDraft}>Apply market overrides</button>
              <button type="button" className="secondary-button" onClick={exportMarketOverrideDraft}>Download market JSON</button>
              <label className="secondary-button compact-button file-button">
                <span>Upload market JSON</span>
                <input type="file" accept="application/json,.json" onChange={(event) => importDraftFile('market', event)} />
              </label>
            </div>

            <label>
              <span>Custom flower prices draft JSON</span>
              <textarea value={customPricesDraft} onChange={(event) => setCustomPricesDraft(event.target.value)} rows={14} />
            </label>
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={applyCustomPricesDraft}>Apply custom flower prices</button>
              <button type="button" className="secondary-button" onClick={exportCustomPricesDraft}>Download custom prices JSON</button>
              <label className="secondary-button compact-button file-button">
                <span>Upload custom prices JSON</span>
                <input type="file" accept="application/json,.json" onChange={(event) => importDraftFile('custom', event)} />
              </label>
              <button type="button" className="secondary-button" onClick={resetAdminDrafts}>Reset to current defaults</button>
            </div>
            <p className="muted small">Template help: Lagos/Abuja override draft follows the same shape as <span className="code-inline">marketOverrides.import.json</span>.</p>
          </div>
        </details>

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
