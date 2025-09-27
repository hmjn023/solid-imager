import type { MediaSourceInfo } from "~/lib/types";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type SourceCardProps = {
  mediaSource: MediaSourceInfo;
};

export default function SourceCard(props: SourceCardProps) {
  return (
    <Card class="relative">
      <CardHeader>
        <CardTitle>{props.mediaSource.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{props.mediaSource.description}</CardDescription>
        <p>Type: {props.mediaSource.type}</p>
        {/* HACK: connectionInfo is not guaranteed to be an object with path */}
        <p>
          Path:{" "}
          {typeof props.mediaSource.connectionInfo === "object" &&
          props.mediaSource.connectionInfo !== null &&
          "path" in props.mediaSource.connectionInfo
            ? String(props.mediaSource.connectionInfo.path)
            : "N/A"}
        </p>
      </CardContent>
      {/* Buttons are now handled externally 
      <div class="absolute top-4 right-4 flex gap-2">
        <Button
          size="sm"
          type="button"
          variant="outline"
        >
          Edit
        </Button>
        <Button
          size="sm"
          type="button"
          variant="destructive"
        >
          Delete
        </Button>
      </div>
      */}
    </Card>
  );
}
