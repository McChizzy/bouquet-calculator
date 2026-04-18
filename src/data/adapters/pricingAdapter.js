function toId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalizeProduct(record) {
  return {
    id: record.id ?? toId(record.sku ?? record.name),
    sku: record.sku,
    name: record.name,
    category: record.category,
    unit: record.unit ?? 'bouquet',
    pricingType: record.pricingType ?? inferPricingType(record.prices),
    prices: compactPrices(record.prices),
    description: record.description ?? '',
    source: record.source,
    sourceDetail: record.sourceDetail,
    image: record.image,
    imageSource: record.imageSource,
  }
}

function inferPricingType(prices = {}) {
  const firstEntry = Object.values(prices).find(Boolean)
  return firstEntry?.type ?? 'custom'
}

function compactPrices(prices = {}) {
  return Object.fromEntries(Object.entries(prices).filter(([, value]) => Boolean(value)))
}

export function mergeMarketPrices(baseRecords, marketOverrides = {}) {
  const overridesBySku = Object.values(marketOverrides)
    .flatMap((market) => market.products ?? [])
    .reduce((map, record) => {
      map[record.sku] = {
        ...(map[record.sku] ?? {}),
        ...compactPrices(record.prices),
      }
      return map
    }, {})

  return baseRecords.map((record) => {
    const mergedPrices = {
      ...compactPrices(record.prices),
      ...(overridesBySku[record.sku] ?? {}),
    }

    return normalizeProduct({ ...record, prices: mergedPrices })
  })
}

export function normalizeProducts(records) {
  return records.map(normalizeProduct)
}
