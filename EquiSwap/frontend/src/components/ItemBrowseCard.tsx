import { useState } from "react";
import { ApiError, createWishlistEntry, resolveAssetUrl } from "../lib/api";
import type { ApiItem, ApiWishlistEntry } from "../lib/api";

type ItemBrowseCardProps = {
  item: ApiItem;
  ownerName: string;
  isWishlisted: boolean;
  onAdded: (entry: ApiWishlistEntry) => void;
};

export function ItemBrowseCard({
  item,
  ownerName,
  isWishlisted,
  onAdded,
}: ItemBrowseCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageSrc = resolveAssetUrl(item.image_url);

  async function handleAdd() {
    setError(null);
    setIsSubmitting(true);
    try {
      const entry = await createWishlistEntry(item.item_id);
      onAdded(entry);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to add to wishlist. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="item-card">
      {imageSrc ? (
        <img src={imageSrc} alt={item.name} className="item-card-image" />
      ) : (
        <div
          className="item-card-image item-card-image-placeholder"
          aria-hidden="true"
        >
          No picture
        </div>
      )}

      <div className="item-card-body">
        <h3>{item.name}</h3>
        <p className="item-card-meta">
          Owner: {ownerName} · Condition {item.condition_score}/10
        </p>
        {item.description && (
          <p className="item-card-description">{item.description}</p>
        )}
      </div>

      <div className="item-card-footer">
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {isWishlisted ? (
          <span className="status-pill status-available">In wishlist</span>
        ) : (
          <button
            type="button"
            className="dashboard-toggle"
            onClick={handleAdd}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add to wishlist"}
          </button>
        )}
      </div>
    </article>
  );
}
