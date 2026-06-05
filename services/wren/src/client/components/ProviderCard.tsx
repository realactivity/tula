import type { BrandItem } from '../lib/brands/types';

interface Props {
  item: BrandItem & { _matchedCount?: number; _totalCount?: number };
  onClick: (item: BrandItem) => void;
}

export default function ProviderCard({ item, onClick }: Props) {
  const hasLocation = item.city || item.state;
  const isCollapsed = item._matchedCount && item._totalCount && item._totalCount > 1;

  return (
    <div className="provider-card" onClick={() => onClick(item)}>
      <div className="provider-card-content">
        <h3 className="provider-card-name">{item.displayName}</h3>
        {item.brandName !== item.displayName && (
          <p className="provider-card-brand">{item.brandName}</p>
        )}
        {hasLocation && !isCollapsed && (
          <p className="provider-card-location">
            {[item.city, item.state].filter(Boolean).join(', ')}
          </p>
        )}
        {isCollapsed && (
          <p className="provider-card-collapsed">
            {item._matchedCount} of {item._totalCount} locations match
          </p>
        )}
      </div>
      <span className="provider-card-arrow">›</span>
    </div>
  );
}
