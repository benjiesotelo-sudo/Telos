import { Component, type ReactNode } from 'react'

export class ResultBoundary extends Component<{ children: ReactNode; label?: string }, { msg: string | null }> {
  state = { msg: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { msg: e instanceof Error ? e.message : String(e) } }
  render() {
    return this.state.msg
      ? <p role="alert">Display error{this.props.label ? ` (${this.props.label})` : ''}: {this.state.msg}</p>
      : this.props.children
  }
}
