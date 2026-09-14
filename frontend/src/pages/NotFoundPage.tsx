import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="page">
      <div className="card">
        <div className="empty">Sivua ei löytynyt.</div>
        <Link to="/" className="btn btn-outline" style={{ marginTop: 12 }}>
          Etusivulle
        </Link>
      </div>
    </div>
  )
}
