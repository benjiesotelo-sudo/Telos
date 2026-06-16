import { describe, it, expect } from 'vitest'
import { positiveLevel, binaryCode } from './binaryCoding'

// Regression guard for the DiD/PSM sign-flip the adversarial review caught: alphabetical order picks the wrong
// "1" level for pre/post (post < pre), flipping the DiD interaction sign.
describe('positiveLevel / binaryCode (2-level coding for DiD treatment/period + PSM treatment)', () => {
  it('0/1 → "1" is positive', () => expect(positiveLevel(['0', '1'])).toBe('1'))
  it('1/2 numeric coding → the larger value is positive (not the "1" token)', () => expect(positiveLevel(['1', '2'])).toBe('2'))
  it('pre/post → "post" is positive (alphabetical would wrongly pick "pre")', () => {
    expect(positiveLevel(['post', 'pre'])).toBe('post')
    expect(positiveLevel(['pre', 'post'])).toBe('post')
    expect(binaryCode('post', positiveLevel(['pre', 'post']))).toBe(1)
    expect(binaryCode('pre', positiveLevel(['pre', 'post']))).toBe(0)
  })
  it('treated/control → "treated" is positive', () => expect(positiveLevel(['control', 'treated'])).toBe('treated'))
  it('yes/no and true/false → the affirmative is positive', () => {
    expect(positiveLevel(['no', 'yes'])).toBe('yes')
    expect(positiveLevel(['false', 'true'])).toBe('true')
  })
  it('unknown string labels fall back to alphabetically-later (documented limitation)', () =>
    expect(positiveLevel(['alpha', 'beta'])).toBe('beta'))
})
