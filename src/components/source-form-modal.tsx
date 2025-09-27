import { clientOnly } from "@solidjs/start";
import { createSignal, type JSX } from "solid-js";
import type { MediaSource, NewMediaSource } from "~/db/schema";
import type { MediaSourceTypeEnum } from "~/lib/types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type SourceFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewMediaSource | Partial<MediaSource>) => Promise<void>;
  editingSource?: MediaSource;
  isLoading?: boolean;
};

function SourceFormModalInner(props: SourceFormModalProps) {
  const [name, setName] = createSignal(props.editingSource?.name ?? "");
  const [description, setDescription] = createSignal(
    props.editingSource?.description ?? ""
  );
  const [type, setType] = createSignal<MediaSourceTypeEnum>(
    props.editingSource?.type ?? "local"
  );
  const [path, setPath] = createSignal(
    typeof props.editingSource?.connectionInfo === "object" &&
      props.editingSource?.connectionInfo !== null &&
      "path" in props.editingSource.connectionInfo
      ? String(props.editingSource.connectionInfo.path)
      : ""
  );

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
    e
  ) => {
    e.preventDefault();

    const formData: NewMediaSource | Partial<MediaSource> = {
      name: name(),
      description: description() || null,
      type: type(),
      connectionInfo: { path: path() },
    };

    if (props.editingSource) {
      await props.onSubmit(formData);
    } else {
      await props.onSubmit(formData as NewMediaSource);
    }

    // Reset form
    setName("");
    setDescription("");
    setType("local");
    setPath("");
  };

  const isFormValid = () => name().trim() !== "" && path().trim() !== "";

  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {props.editingSource ? "Edit Media Source" : "Add Media Source"}
          </DialogTitle>
          <DialogDescription>
            {props.editingSource
              ? "Update the media source information."
              : "Create a new media source to manage your media files."}
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" onSubmit={handleSubmit}>
          <div class="space-y-2">
            <label class="font-medium text-sm" for="name">
              Name
            </label>
            <Input
              id="name"
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Enter source name"
              required
              type="text"
              value={name()}
            />
          </div>

          <div class="space-y-2">
            <label class="font-medium text-sm" for="description">
              Description
            </label>
            <Input
              id="description"
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Enter description (optional)"
              type="text"
              value={description()}
            />
          </div>

          <div class="space-y-2">
            <label class="font-medium text-sm">Type</label>
            <Select
              itemComponent={(props) => (
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
              )}
              onChange={setType}
              options={["local", "sftp", "s3"]}
              placeholder="Select type"
              value={type()}
            >
              <SelectTrigger>
                <SelectValue<string> />
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <div class="space-y-2">
            <label class="font-medium text-sm" for="path">
              Path
            </label>
            <Input
              id="path"
              onInput={(e) => setPath(e.currentTarget.value)}
              placeholder="Enter file path"
              required
              type="text"
              value={path()}
            />
          </div>

          <DialogFooter>
            <Button
              onClick={() => props.onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!isFormValid() || props.isLoading} type="submit">
              {props.isLoading
                ? "Saving..."
                : props.editingSource
                  ? "Update"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SourceFormModal = clientOnly(() =>
  Promise.resolve({ default: SourceFormModalInner })
);

export default SourceFormModal;
