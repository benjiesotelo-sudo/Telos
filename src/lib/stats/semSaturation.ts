/**
 * The ONE shared saturation predicate (design §3.6, §5.1). A model is saturated iff lavaan reports df==0,
 * in which case the fit table is suppressed (perfect, uninformative fit) and a saturation flag is emitted.
 * The builder, the latent.ts emitter, and the runs-in-r gate ALL call this so screen/export/native agree.
 * Keyed strictly on df, NOT on recursiveness.
 */
export function isSaturated(df: number): boolean {
  return df === 0
}
