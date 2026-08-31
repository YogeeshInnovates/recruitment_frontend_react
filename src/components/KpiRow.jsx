import { Link } from 'react-router-dom';

export default function KpiRow({ items }) {
  return (
    <div className="kpi-row">
      {items.map((item) => (
        <Link to={item.to || '#'} className="kpi-card" key={item.label} onClick={(e) => { if (!item.to) e.preventDefault(); }}>
          <div className="kpi-icon" style={{ background: item.color || 'linear-gradient(135deg,#2563eb,#3b82f6)' }}>
            {item.icon}
          </div>
          <div className="kpi-body">
            <div className="kpi-value">{item.value}</div>
            <div className="kpi-label">{item.label}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
