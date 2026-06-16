import type { Emitter } from './index'
import { modelsummaryCall } from '../helpers'

// Worked reference for the family. Tasks 3-5 fill in the remaining emitters; the call shapes here are the template.
export const regressionEmitters: Record<string, Emitter> = {
  'simple-linear-regression': (_spec, setup) => {
    const y = setup.roles['outcome'][0], x = setup.roles['predictor'][0]
    return [
      `m <- lm(${y} ~ ${x}, data = d)`,
      modelsummaryCall('m', { gof: 'lm' }),
      `print(ggplot(d, aes(${x}, ${y})) + geom_point() + geom_smooth(method = "lm"))`,
    ].join('\n')
  },
}

export const regressionPackages: Record<string, string[]> = {
  'simple-linear-regression': ['modelsummary', 'ggplot2'],
}
