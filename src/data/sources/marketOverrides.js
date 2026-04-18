import marketOverrideImport from './marketOverrides.import.json'

const priceShapeExamples = {
  fixed: { type: 'fixed', amount: 250000 },
  range: { type: 'range', min: 50000, max: 80000 },
  tiered: { type: 'tiered', tiers: [{ minQuantity: 1, unitPrice: 38000 }] },
  custom: { type: 'custom', note: 'Manual review required' },
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeOverrideRecord(record, market) {
  if (!record?.sku) {
    return null
  }

  if (record.prices?.[market]) {
    return {
      sku: record.sku,
      prices: {
        [market]: record.prices[market],
      },
    }
  }

  if (record.price) {
    return {
      sku: record.sku,
      prices: {
        [market]: record.price,
      },
    }
  }

  return null
}

function normalizeMarketImport(importData = {}) {
  return {
    lagos: {
      source: 'Drop confirmed Lagos rows into marketOverrides.import.json or replace this array directly.',
      products: toArray(importData.lagos)
        .map((record) => normalizeOverrideRecord(record, 'lagos'))
        .filter(Boolean),
    },
    abuja: {
      source: 'Drop confirmed Abuja rows into marketOverrides.import.json or replace this array directly.',
      products: toArray(importData.abuja)
        .map((record) => normalizeOverrideRecord(record, 'abuja'))
        .filter(Boolean),
    },
  }
}

export const marketOverrideImportTemplate = {
  instructions:
    'Paste confirmed Lagos and Abuja sale-price rows here. Keep only confirmed values and leave missing markets empty so the app falls back to retail visibly.',
  lagos: [
    { sku: 'BBF-PCL-S', price: priceShapeExamples.range },
    { sku: 'BBF-BRB-DLX-M', price: priceShapeExamples.fixed },
  ],
  abuja: [
    { sku: 'BBF-PCL-S', price: priceShapeExamples.range },
    { sku: 'BBF-BRB-DLX-M', price: priceShapeExamples.fixed },
  ],
}

export const bloomfieldMarketOverrides = normalizeMarketImport(marketOverrideImport)

export const marketOverrideStatus = {
  lagos: bloomfieldMarketOverrides.lagos.products.length,
  abuja: bloomfieldMarketOverrides.abuja.products.length,
}
