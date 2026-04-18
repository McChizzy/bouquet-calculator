const midpoint = (min, max) => Math.round((min + max) / 2)

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPercentage(value) {
  return `${value}%`
}

export function formatLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getPriceTypeLabel(type) {
  return {
    fixed: 'Fixed',
    range: 'Range',
    tiered: 'Tiered',
    custom: 'Custom / manual',
  }[type] ?? formatLabel(type)
}

export function getPriceBandLabel(band) {
  return formatLabel(band)
}

export function getCityLabel(city) {
  return formatLabel(city)
}

export function getPricingEntry(item, city) {
  const marketEntry = item.prices?.[city]
  const retailEntry = item.prices?.retail
  const entry = marketEntry ?? retailEntry

  return {
    entry,
    hasMarketOverride: Boolean(marketEntry),
    usedFallback: !marketEntry && Boolean(retailEntry),
    source: marketEntry ? city : retailEntry ? 'retail' : 'missing',
  }
}

function resolveFixedPrice(entry) {
  return {
    unitPrice: entry.amount,
    pricingType: 'fixed',
    priceRange: { min: entry.amount, max: entry.amount },
    selectionLabel: 'Fixed price',
  }
}

function resolveRangePrice(entry, band) {
  const min = entry.min
  const max = entry.max
  const bandToPrice = {
    low: min,
    standard: midpoint(min, max),
    premium: max,
  }

  return {
    unitPrice: bandToPrice[band] ?? bandToPrice.standard,
    pricingType: 'range',
    priceRange: { min, max },
    selectionLabel: `${getPriceBandLabel(band)} band`,
  }
}

function resolveTieredPrice(entry, quantity) {
  const tiers = [...entry.tiers].sort((left, right) => left.minQuantity - right.minQuantity)
  const selectedTier = tiers.reduce((current, tier) => (quantity >= tier.minQuantity ? tier : current), tiers[0])

  return {
    unitPrice: selectedTier.unitPrice,
    pricingType: 'tiered',
    selectedTier,
    tiers,
    selectionLabel: `Tier ${selectedTier.minQuantity}+`,
  }
}

function resolveCustomPrice(entry) {
  return {
    unitPrice: 0,
    pricingType: 'custom',
    selectionLabel: 'Manual review required',
    note: entry.note,
  }
}

export function getResolutionStatus(resolved, city) {
  if (resolved.source === 'missing') {
    return {
      tone: 'danger',
      label: 'Price missing',
      detail: `No ${getCityLabel(city)} override or retail fallback is loaded yet.`,
    }
  }

  if (resolved.usedFallback) {
    return {
      tone: 'warning',
      label: 'Retail fallback',
      detail: `${getCityLabel(city)} override missing, using Bloomfield retail sample pricing.`,
    }
  }

  return {
    tone: 'success',
    label: `${getCityLabel(city)} override loaded`,
    detail: `Confirmed ${getCityLabel(city)} market pricing is being used.`,
  }
}

export function resolveUnitPrice({ item, city, band = 'standard', quantity = 1 }) {
  const { entry, usedFallback, source, hasMarketOverride } = getPricingEntry(item, city)

  if (!entry) {
    return {
      unitPrice: 0,
      pricingType: item.pricingType,
      source,
      hasMarketOverride,
      usedFallback: false,
      selectionLabel: 'Missing price',
      note: 'No pricing entry found for this item.',
    }
  }

  const resolved =
    entry.type === 'fixed'
      ? resolveFixedPrice(entry)
      : entry.type === 'range'
        ? resolveRangePrice(entry, band)
        : entry.type === 'tiered'
          ? resolveTieredPrice(entry, quantity)
          : resolveCustomPrice(entry)

  return {
    ...resolved,
    source,
    hasMarketOverride,
    usedFallback,
  }
}

export function createQuoteSummary({
  city,
  quoteType,
  catalogSelection,
  customSelections,
  quantity,
  band,
  deliveryFee,
  discountPercent,
}) {
  const lineItems = []
  let subtotal = 0
  const notes = []

  if (quoteType === 'catalog' && catalogSelection) {
    const resolved = resolveUnitPrice({ item: catalogSelection, city, band, quantity })
    const lineSubtotal = resolved.unitPrice * quantity
    subtotal += lineSubtotal
    lineItems.push({
      label: catalogSelection.name,
      detail: `${resolved.selectionLabel} • ${formatCurrency(resolved.unitPrice)} x ${quantity}`,
      amount: lineSubtotal,
      metadata: {
        pricingType: resolved.pricingType,
        source: resolved.source,
        hasMarketOverride: resolved.hasMarketOverride,
        usedFallback: resolved.usedFallback,
      },
    })

    if (resolved.usedFallback) {
      notes.push(`Catalog price used Bloomfield retail sample fallback because the ${getCityLabel(city)} override is still missing.`)
    }

    if (resolved.source === 'missing') {
      notes.push(`Catalog price is unavailable because neither ${getCityLabel(city)} nor retail pricing is loaded.`)
    }

    if (resolved.note) {
      notes.push(resolved.note)
    }
  }

  if (quoteType === 'custom') {
    customSelections
      .filter((item) => item.count > 0)
      .forEach((item) => {
        const resolved = resolveUnitPrice({ item: item.component, city, quantity: item.count })

        if (resolved.source === 'missing') {
          notes.push(`${item.component.name} has no confirmed ${getCityLabel(city)} sheet price yet.`)
          return
        }

        const lineSubtotal = resolved.unitPrice * item.count
        subtotal += lineSubtotal
        lineItems.push({
          label: item.component.name,
          detail: `${formatCurrency(resolved.unitPrice)} x ${item.count} ${item.component.unit}${item.count === 1 ? '' : 's'}`,
          amount: lineSubtotal,
          metadata: {
            pricingType: resolved.pricingType,
            source: resolved.source,
            hasMarketOverride: resolved.hasMarketOverride,
            usedFallback: resolved.usedFallback,
          },
        })

        if (resolved.usedFallback) {
          notes.push(`${item.component.name} used Bloomfield retail sample fallback for ${getCityLabel(city)}.`)
        }

        if (resolved.note) {
          notes.push(resolved.note)
        }
      })
  }

  const discountAmount = Math.round(subtotal * ((discountPercent || 0) / 100))

  const adjustments = [
    { label: 'Delivery', amount: deliveryFee },
    { label: `Discount (${formatPercentage(discountPercent || 0)})`, amount: -discountAmount },
  ].filter((item) => item.amount !== 0)

  const total = subtotal + adjustments.reduce((sum, item) => sum + item.amount, 0)

  return {
    subtotal,
    adjustments,
    total,
    lineItems,
    notes,
    city: getCityLabel(city),
    quoteType,
    discountAmount,
    discountPercent: discountPercent || 0,
  }
}
