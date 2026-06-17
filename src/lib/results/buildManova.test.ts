import { describe, it, expect } from 'vitest'
import { buildManova } from './buildManova'
import { MANOVA as spec } from '../registry/manova'
import type { ManovaResult } from '../stats/manova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike known answers: outcome+outcome2 ~ group (Pillai run)
const pillaiResult: ManovaResult = {
  multivariate: [{
    effect: 'group',
    stat: 0.285431562210818, f: 4.74451724627428, df1: 4, df2: 114, p: 0.00140868628003122,
    pillai: 0.285431562210818, pillaiF: 4.74451724627428, pillaiDf1: 4, pillaiDf2: 114, pillaiP: 0.00140868628003122,
  }],
  followups: [
    { dv: 'outcome', f: 2.80500665877123, df1: 2, df2: 57, p: 0.0688787403297547, pes: 0.0896024935993843, pesLow: 0, pesHigh: 1 },
    { dv: 'outcome2', f: 7.71055236740481, df1: 2, df2: 57, p: 0.00108711814052799, pes: 0.2129366128, pesLow: 0.0638706439, pesHigh: 1 },
  ],
  statistic: 'Pillai',
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

// Wilks run: stat and selected values differ from Pillai
const wilksResult: ManovaResult = {
  multivariate: [{
    effect: 'group',
    stat: 0.715289868403666, f: 5.10678393890843, df1: 4, df2: 114, p: 0.000811876083019458,
    pillai: 0.285431562210818, pillaiF: 4.74451724627428, pillaiDf1: 4, pillaiDf2: 114, pillaiP: 0.00140868628003122,
  }],
  followups: [
    { dv: 'outcome', f: 2.80500665877123, df1: 2, df2: 57, p: 0.0688787403297547, pes: 0.0896024935993843, pesLow: 0, pesHigh: 1 },
    { dv: 'outcome2', f: 7.71055236740481, df1: 2, df2: 57, p: 0.00108711814052799, pes: 0.2129366128, pesLow: 0.0638706439, pesHigh: 1 },
  ],
  statistic: 'Wilks',
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

// No follow-ups result (Pillai selected)
const noFollowupsResult: ManovaResult = {
  ...pillaiResult,
  followups: [],
}

describe('buildManova', () => {
  describe('Pillai run', () => {
    const c = buildManova(spec, pillaiResult)

    it('Table 1: multivariate row formatted correctly', () => {
      expect(c.tables[0].spec.id).toBe('multivariate')
      expect(c.tables[0].rows).toHaveLength(1)
      expect(c.tables[0].rows[0]).toEqual({
        effect: 'group',
        stat: '0.29',
        f: '4.74',
        df1: '4',
        df2: '114',
        p: '.001',
      })
    })

    it('Table 2: follow-up univariate rows', () => {
      expect(c.tables).toHaveLength(2)
      expect(c.tables[1].spec.id).toBe('univariate-followups')
      expect(c.tables[1].rows[0]).toEqual({
        dv: 'outcome',
        f: '2.81',
        df1: '2',
        df2: '57',
        p: '.069',
        pes: '0.09 [0.00, 1.00]', // partial η² with its one-sided 95% CI (upper pinned at 1.00)
      })
    })

    it('NO table note (card has none)', () => {
      expect(c.note).toBeNull()
    })

    it('figure caption and type', () => {
      expect(c.figures).toEqual([{ caption: 'Group means per outcome', type: 'means plot faceted by DV', file: 'means', png }])
    })

    it('APA from selected stat fields: Pillai run gives Pillai label', () => {
      expect(c.apa).toBe("A MANOVA gave Pillai's V=.29, F(4,114)=4.74, p = .001.")
    })

    it('nExcluded passthrough', () => {
      expect(c.nExcluded).toBe(0)
    })
  })

  describe('Wilks-selected run APAs the selected statistic (owner ruling)', () => {
    const c = buildManova(spec, wilksResult)

    it('APA uses Wilks label and values when statistic=Wilks', () => {
      expect(c.apa).toBe("A MANOVA gave Wilks' Λ=.72, F(4,114)=5.11, p < .001.")
    })

    it('Table 1 stat column shows Wilks value (the selected statistic)', () => {
      expect(c.tables[0].rows[0].stat).toBe('0.72')
    })
  })

  describe('followups=off', () => {
    const c = buildManova(spec, noFollowupsResult)

    it('only one table when follow-ups empty', () => {
      expect(c.tables).toHaveLength(1)
      expect(c.tables[0].spec.id).toBe('multivariate')
    })

    it('APA still renders with Pillai label (Pillai selected)', () => {
      expect(c.apa).toContain("Pillai's V=.29")
    })
  })
})
