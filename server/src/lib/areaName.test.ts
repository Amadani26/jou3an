import { describe, expect, it } from 'vitest'
import {
  areaNameFromComponents,
  areaNameFromFormattedAddress,
  cleanAreaToken,
  displayArea,
  resolveAreaName,
} from './areaName'

const comp = (longText: string, ...types: string[]) => ({ longText, types })

describe('areaNameFromComponents', () => {
  it('prefers neighborhood', () => {
    expect(
      areaNameFromComponents([
        comp('Dubai', 'locality'),
        comp('Al Satwa', 'neighborhood'),
        comp('Al Satwa Area', 'sublocality_level_1'),
      ]),
    ).toBe('Al Satwa')
  })

  it('falls through the specificity ladder', () => {
    expect(
      areaNameFromComponents([comp('Dubai', 'locality'), comp('Mirdif', 'sublocality_level_1')]),
    ).toBe('Mirdif')
    expect(areaNameFromComponents([comp('Motor City', 'sublocality')])).toBe('Motor City')
  })

  it('never returns the city or country', () => {
    // "Dubai" as a locality is useless — the user already knows they're in Dubai.
    expect(
      areaNameFromComponents([
        comp('Dubai', 'locality'),
        comp('United Arab Emirates', 'country'),
      ]),
    ).toBeNull()
    // Even if Google tags "Dubai" as a neighborhood, it is still useless.
    expect(areaNameFromComponents([comp('Dubai', 'neighborhood')])).toBeNull()
  })

  it('returns null for missing or empty components', () => {
    expect(areaNameFromComponents(null)).toBeNull()
    expect(areaNameFromComponents([])).toBeNull()
    expect(areaNameFromComponents([comp('', 'neighborhood')])).toBeNull()
  })
})

describe('areaNameFromFormattedAddress', () => {
  it('takes the broadest segment that is not the city', () => {
    // Dubai addresses run specific -> general, so the last non-city segment is
    // the neighbourhood.
    expect(
      areaNameFromFormattedAddress('The Walk - Dubai Marina - Dubai - United Arab Emirates'),
    ).toBe('Dubai Marina')
    expect(areaNameFromFormattedAddress('Al Satwa - Dubai - United Arab Emirates')).toBe(
      'Al Satwa',
    )
  })

  it('handles a street-level prefix', () => {
    expect(
      areaNameFromFormattedAddress(
        'Silverene Tower B, Ground Floor - Dubai Marina - Dubai',
      ),
    ).toBe('Dubai Marina')
  })

  it('skips plus codes', () => {
    expect(areaNameFromFormattedAddress('34RM+FW - Al Sufouh - Dubai')).toBe('Al Sufouh')
    expect(areaNameFromFormattedAddress('34HR+C32 - Dubai')).toBeNull()
  })

  it('skips unit and floor segments', () => {
    expect(areaNameFromFormattedAddress('Shop 24 - Level P - Mirdif - Dubai')).toBe('Mirdif')
  })

  it('returns null when only the city is present', () => {
    expect(areaNameFromFormattedAddress('Dubai - United Arab Emirates')).toBeNull()
    expect(areaNameFromFormattedAddress('')).toBeNull()
    expect(areaNameFromFormattedAddress(null)).toBeNull()
  })

  it('ignores one- and two-character noise segments', () => {
    expect(areaNameFromFormattedAddress('B - Al Quoz - Dubai')).toBe('Al Quoz')
  })
})

describe('resolveAreaName', () => {
  it('prefers components over the formatted address', () => {
    expect(
      resolveAreaName([comp('Umm Suqeim', 'neighborhood')], 'Somewhere Else - Dubai'),
    ).toBe('Umm Suqeim')
  })

  it('falls back to the formatted address', () => {
    expect(resolveAreaName([], 'Jumeirah 1 - Dubai')).toBe('Jumeirah 1')
    expect(resolveAreaName(null, 'Business Bay - Dubai')).toBe('Business Bay')
  })

  it('returns null when neither yields anything', () => {
    expect(resolveAreaName(null, 'Dubai')).toBeNull()
    expect(resolveAreaName([], null)).toBeNull()
  })
})

describe('cleanAreaToken', () => {
  it('strips plus-code prefixes and tidies edges', () => {
    expect(cleanAreaToken('34HR+C32 The Atlantic')).toBe('The Atlantic')
    expect(cleanAreaToken('  Al Wasl ,')).toBe('Al Wasl')
  })
})

describe('displayArea', () => {
  it('prefers the real neighbourhood', () => {
    expect(displayArea({ areaName: 'Al Satwa', area: 'OTHER' })).toBe('Al Satwa')
  })

  it('falls back to the deprecated enum label', () => {
    // A row that has never been synced must still read sensibly.
    expect(displayArea({ areaName: null, area: 'MARINA' })).toBe('Dubai Marina')
    expect(displayArea({ areaName: '', area: 'DIFC' })).toBe('DIFC')
    expect(displayArea({ area: 'BUSINESS_BAY' })).toBe('Business Bay')
  })

  it('degrades to "Dubai" when there is nothing at all', () => {
    expect(displayArea({ areaName: null, area: 'OTHER' })).toBe('Dubai')
    expect(displayArea({})).toBe('Dubai')
  })

  it('treats a whitespace-only areaName as absent', () => {
    expect(displayArea({ areaName: '   ', area: 'JLT' })).toBe('JLT')
  })
})
