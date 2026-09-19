import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  ApiError,
  createItem,
  resolveAssetUrl,
  updateItem,
  uploadItemImage,
} from "../lib/api";
import type { ApiItem } from "../lib/api";

type ItemFormProps = {
  item?: ApiItem;
  onSaved: (item: ApiItem) => void;
  onCancel?: () => void;
};

const STATUS_OPTIONS = ["available", "swap_pending", "swapped"];

export function ItemForm({ item, onSaved, onCancel }: ItemFormProps) {
  const isEditing = Boolean(item);
  const formId = item ? String(item.item_id) : "new";

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [conditionScore, setConditionScore] = useState(
    item?.condition_score ?? 5,
  );
  const [status, setStatus] = useState(item?.status ?? "available");
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setIsUploadingImage(true);
    try {
      const { url } = await uploadItemImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to upload the picture. Please try again.",
      );
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Item name is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        condition_score: conditionScore,
        status,
        image_url: imageUrl.trim() || null,
      };
      const saved =
        isEditing && item
          ? await updateItem(item.item_id, payload)
          : await createItem(payload);

      onSaved(saved);
      if (!isEditing) {
        setName("");
        setDescription("");
        setConditionScore(5);
        setStatus("available");
        setImageUrl("");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to save the item. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="item-form" onSubmit={handleSubmit}>
      <div className="item-form-field">
        <label htmlFor={`item-name-${formId}`}>Name</label>
        <input
          id={`item-name-${formId}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="item-form-field">
        <label htmlFor={`item-description-${formId}`}>Description</label>
        <textarea
          id={`item-description-${formId}`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </div>

      <div className="item-form-row">
        <div className="item-form-field">
          <label htmlFor={`item-condition-${formId}`}>Condition (1-10)</label>
          <input
            id={`item-condition-${formId}`}
            type="number"
            min={1}
            max={10}
            value={conditionScore}
            onChange={(event) => setConditionScore(Number(event.target.value))}
          />
        </div>

        <div className="item-form-field">
          <label htmlFor={`item-status-${formId}`}>Status</label>
          <select
            id={`item-status-${formId}`}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="item-form-field">
        <label htmlFor={`item-image-${formId}`}>Picture</label>
        <input
          id={`item-image-${formId}`}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleImageChange}
          disabled={isUploadingImage}
        />
        {isUploadingImage && (
          <p className="item-form-hint">Uploading picture...</p>
        )}
        {imageUrl && !isUploadingImage && (
          <img
            src={resolveAssetUrl(imageUrl) ?? imageUrl}
            alt="Item preview"
            className="item-form-preview"
          />
        )}
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="item-form-actions">
        <button
          type="submit"
          className="auth-submit"
          disabled={isSubmitting || isUploadingImage}
        >
          {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Add item"}
        </button>
        {onCancel && (
          <button type="button" className="item-form-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
