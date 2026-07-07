export function WhyThisTest({ text }: { text: string }) {
  if (!text.trim()) return null
  return <p className="hint" style={{ marginTop: 2, marginBottom: 8 }}>{text}</p>
}
