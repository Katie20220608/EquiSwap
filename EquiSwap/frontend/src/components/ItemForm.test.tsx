import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemForm } from "./ItemForm";
import { ApiError, createItem, updateItem, uploadItemImage } from "../lib/api";
import type { ApiItem } from "../lib/api";

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    createItem: vi.fn(),
    updateItem: vi.fn(),
    uploadItemImage: vi.fn(),
  };
});

const existingItem: ApiItem = {
  item_id: 1,
  owner_id: 1,
  name: "Desk lamp",
  description: "Warm light",
  category_id: null,
  condition_score: 7,
  status: "available",
  image_url: null,
};

describe("ItemForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires a name before submitting", async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<ItemForm onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: "Add item" }));

    expect(
      await screen.findByText("Item name is required."),
    ).toBeInTheDocument();
    expect(createItem).not.toHaveBeenCalled();
  });

  it("creates a new item and resets the form", async () => {
    vi.mocked(createItem).mockResolvedValue({ ...existingItem, item_id: 2 });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<ItemForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Ceramic mug");
    await user.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(createItem).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Ceramic mug", status: "available" }),
      ),
    );
    expect(onSaved).toHaveBeenCalledWith({ ...existingItem, item_id: 2 });
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("saves changes to an existing item", async () => {
    vi.mocked(updateItem).mockResolvedValue({
      ...existingItem,
      name: "Updated lamp",
    });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<ItemForm item={existingItem} onSaved={onSaved} />);

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Updated lamp");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: "Updated lamp" }),
      ),
    );
    expect(onSaved).toHaveBeenCalledWith({
      ...existingItem,
      name: "Updated lamp",
    });
  });

  it("shows the server error message when saving fails", async () => {
    vi.mocked(createItem).mockRejectedValue(
      new ApiError("Invalid category_id: category does not exist", 422),
    );
    const user = userEvent.setup();
    render(<ItemForm onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Ceramic mug");
    await user.click(screen.getByRole("button", { name: "Add item" }));

    expect(
      await screen.findByText("Invalid category_id: category does not exist"),
    ).toBeInTheDocument();
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ItemForm item={existingItem} onSaved={vi.fn()} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("uploads a picture and includes the returned url when saving", async () => {
    vi.mocked(uploadItemImage).mockResolvedValue({ url: "/uploads/mug.png" });
    vi.mocked(createItem).mockResolvedValue({
      ...existingItem,
      item_id: 3,
      image_url: "/uploads/mug.png",
    });
    const user = userEvent.setup();
    render(<ItemForm onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText("Name"), "Ceramic mug");
    const file = new File(["pixels"], "mug.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Picture"), file);

    await waitFor(() => expect(uploadItemImage).toHaveBeenCalledWith(file));
    expect(await screen.findByRole("img")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(createItem).toHaveBeenCalledWith(
        expect.objectContaining({ image_url: "/uploads/mug.png" }),
      ),
    );
  });

  it("shows an error when the picture upload fails", async () => {
    vi.mocked(uploadItemImage).mockRejectedValue(
      new ApiError("Image must be smaller than 5MB", 422),
    );
    const user = userEvent.setup();
    render(<ItemForm onSaved={vi.fn()} />);

    const file = new File(["pixels"], "big.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Picture"), file);

    expect(
      await screen.findByText("Image must be smaller than 5MB"),
    ).toBeInTheDocument();
  });
});
