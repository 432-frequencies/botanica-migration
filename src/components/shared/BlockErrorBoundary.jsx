import { Component } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Wraps a block — catches render errors and shows a small inline fallback.
 * Does NOT crash the whole page.
 */
export default class BlockErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="mx-5 my-3 px-3 py-2.5 flex items-center gap-2"
          style={{ background: "rgba(208,48,48,0.06)", border: "1px solid rgba(208,48,48,0.18)" }}
        >
          <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(208,48,48,0.5)" }} />
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(208,48,48,0.45)" }}>
            {this.props.label || "Bloc indisponible"}
          </p>
          {this.props.onRetry && (
            <button
              onClick={() => { this.setState({ hasError: false }); this.props.onRetry(); }}
              className="ml-auto text-[8px] font-black uppercase tracking-wider px-2 py-1"
              style={{ border: "1px solid rgba(208,48,48,0.25)", color: "rgba(208,48,48,0.5)" }}
            >
              Réessayer
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}