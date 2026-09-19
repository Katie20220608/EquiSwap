type SwapCardProps = {
  itemName: string;
  owner: string;
  wants: string;
  status: string;
  accent: "ochre" | "sea";
};

export function SwapCard({
  itemName,
  owner,
  wants,
  status,
  accent,
}: SwapCardProps) {
  return (
    <article className={`swap-card ${accent}`}>
      <div className="item-art" aria-hidden="true">
        <span>↗</span>
      </div>
      <div className="card-content">
        <div className="card-meta">
          <span className="status-dot" /> {status}
        </div>
        <h3>{itemName}</h3>
        <p className="owner">
          Owned by <strong>{owner}</strong>
        </p>
        <div className="swap-detail">
          <span>Looking for</span>
          <strong>{wants}</strong>
        </div>
        <button type="button" className="card-action">
          View proposal <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}
