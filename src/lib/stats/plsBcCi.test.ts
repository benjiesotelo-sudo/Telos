import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { BC_CI_R } from './plsBcCi'

const hasR = (() => { try { execSync('Rscript --version', { stdio: 'ignore' }); return true } catch { return false } })()

// Shared fixture: docs/superpowers/reviews/2026-07-06-moderation-spike.md's ext script proved the hand-rolled
// bc_ci() reproduces lavaan's boot.ci.type="bca.simple" exactly (max |hand-rolled - lavaan| ≈ 0 in the spike
// log). This test re-derives that proof as a committed, re-runnable gate: fit the SAME matched CB-SEM
// moderation model in native R, compute BC via lavaan directly AND via BC_CI_R on the raw boot draws, assert
// they match to 6 decimals — proving BC_CI_R (the text seminr's PLS structural table will reuse) is correct
// BEFORE it is ever wired into plsSem.ts.
describe.skipIf(!hasR)('BC_CI_R hand-rolled bca.simple — native-R verified against lavaan boot.ci.type="bca.simple"', () => {
  it('matches lavaan\'s bca.simple CI for the interaction path b3, to 6 decimals', () => {
    const script = `
      suppressMessages({ library(lavaan); library(semTools) })
      d <- read.csv("${process.cwd()}/.superpowers/sdd/spike-moderation-data.csv")
      pi <- indProd(d, var1=c("sn1","sn2","sn3","sn4"), var2=c("ta1","ta2","ta3","ta4"), match=TRUE, meanC=TRUE, doubleMC=TRUE)
      model <- 'SN=~sn1+sn2+sn3+sn4\nTA=~ta1+ta2+ta3+ta4\nTI=~ti1+ti2+ti3\nSNTA=~sn1.ta1+sn2.ta2+sn3.ta3+sn4.ta4\nTI~b1*SN+b2*TA+b3*SNTA'
      set.seed(20260706)
      fit <- sem(model, data=pi, se="bootstrap", bootstrap=500)
      pe_bc <- parameterEstimates(fit, ci=TRUE, boot.ci.type="bca.simple")
      lav_row <- pe_bc[pe_bc$op=="~" & pe_bc$rhs=="SNTA", c("ci.lower","ci.upper")]
      ${BC_CI_R}
      boots <- lavInspect(fit, "boot"); b3d <- boots[, "b3"]; est <- coef(fit)[["b3"]]
      hand <- bc_ci(b3d, est)
      cat(sprintf("%.8f %.8f %.8f %.8f", lav_row$ci.lower, lav_row$ci.upper, hand[1], hand[2]))
    `
    const out = execSync(`Rscript -e '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf8' })
    const [lavLo, lavHi, handLo, handHi] = out.trim().split(/\s+/).map(Number)
    expect(handLo).toBeCloseTo(lavLo, 6)
    expect(handHi).toBeCloseTo(lavHi, 6)
  })
})
