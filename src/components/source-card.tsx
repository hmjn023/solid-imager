import { A } from "@solidjs/router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { MediaSourceInfo } from "~/domain/sources/schemas";

/**
 * Props for the SourceCard component.
 * @property {MediaSourceInfo} mediaSource - The media source object to display.
 * @property {(source: MediaSourceInfo) => void} [onEdit] - Callback function when the edit button is clicked.
 * @property {(source: MediaSourceInfo) => void} [onDelete] - Callback function when the delete button is clicked.
 */
type SourceCardProps = {
  mediaSource: MediaSourceInfo;
  onEdit?: (source: MediaSourceInfo) => void;
  onDelete?: (source: MediaSourceInfo) => void;
};
/**
 * A card component to display information about a single media source.
 * It includes options to edit and delete the media source.
 * @param {SourceCardProps} props - The properties for the SourceCard component.
 * @returns {JSX.Element} The rendered media source card.
 */
export default function SourceCard(props: SourceCardProps) {
  const handleEditClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    props.onEdit?.(props.mediaSource);
  };

  const handleDeleteClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    props.onDelete?.(props.mediaSource);
  };

  return (
    <A
      class="block text-current no-underline"
      href={`/sources/${props.mediaSource.id}`}
    >
      <Card class="relative h-full hover:bg-gray-50" data-testid="source-card">
        <CardHeader>
          <CardTitle data-testid="source-name">
            {props.mediaSource.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>{props.mediaSource.description}</CardDescription>
          <p>Type: {props.mediaSource.type}</p>
          {/* HACK: connectionInfoはパスを持つオブジェクトである保証はありません */}
          <p>
            Path:{" "}
            {typeof props.mediaSource.connectionInfo === "object" &&
            props.mediaSource.connectionInfo !== null &&
            "path" in props.mediaSource.connectionInfo
              ? String(props.mediaSource.connectionInfo.path)
              : "N/A"}
          </p>
        </CardContent>
        {/* 編集ボタンと削除ボタン */}
        <div class="absolute top-2 right-2 z-10 flex gap-1">
          {props.onEdit && (
            <button
              class="rounded border bg-white px-2 py-1 text-xs shadow hover:bg-gray-50"
              data-testid="edit-source-btn"
              onClick={handleEditClick}
              type="button"
            >
              Edit
            </button>
          )}
          {props.onDelete && (
            <button
              class="rounded bg-red-500 px-2 py-1 text-white text-xs shadow hover:bg-red-600"
              data-testid="delete-source-btn"
              onClick={handleDeleteClick}
              type="button"
            >
              Delete
            </button>
          )}
        </div>
      </Card>
    </A>
  );
}
