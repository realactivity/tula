import type { Provider } from '../lib/api';

interface Props {
  providers: Provider[];
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ProviderList({ providers }: Props) {
  if (providers.length === 0) return null;

  return (
    <ul className="providers-list">
      {providers.map((p, i) => (
        <li key={i}>
          <div>
            <div className="provider-name">{p.name}</div>
            <div className="provider-time">Connected {formatTime(p.connectedAt)}</div>
          </div>
          <span className="check">✓</span>
        </li>
      ))}
    </ul>
  );
}
