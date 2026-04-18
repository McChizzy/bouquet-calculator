import { mergeMarketPrices } from './adapters/pricingAdapter'
import { customFlowerPrices } from './sources/customFlowerPrices'
import { bloomfieldMarketOverrides } from './sources/marketOverrides'
import { bloomfieldRetailSamples } from './sources/bloomfieldRetailSamples'

const cities = [
  { id: 'lagos', label: 'Lagos' },
  { id: 'abuja', label: 'Abuja' },
]

const priceBandOptions = [
  { id: 'low', label: 'Low' },
  { id: 'standard', label: 'Standard' },
  { id: 'premium', label: 'Premium' },
]

const pricingTypes = [
  { id: 'fixed', label: 'Fixed' },
  { id: 'range', label: 'Range' },
  { id: 'tiered', label: 'Tiered' },
  { id: 'custom', label: 'Custom / manual' },
]

const quoteTypes = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'custom', label: 'Custom' },
]

const components = customFlowerPrices

export const pricingMarkets = ['retail', ...cities.map((city) => city.id)]
export const normalizedCatalogProducts = mergeMarketPrices(bloomfieldRetailSamples, bloomfieldMarketOverrides)

export const pricingCatalog = {
  cities,
  pricingMarkets,
  priceBandOptions,
  pricingTypes,
  quoteTypes,
  components,
  catalogProducts: normalizedCatalogProducts,
}
