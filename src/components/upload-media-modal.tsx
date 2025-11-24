import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { fetchFromUrl } from "~/infrastructure/api-clients/fetch-url-api";

type UploadMediaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (options: {
    file: File;
    filename: string;
    description: string;
    sourceUrl?: string;
    overwrite: boolean;
    autoIncrement: boolean;
  }) => Promise<void>;
  initialFile: File | null;
  onUrlFetch: (file: File) => void;
  pastedUrl: string | null;
};

const formSchema = z.object({
  filename: z.string().min(1, "ファイル名は必須です。").optional(),
  description: z.string().optional(),
  sourceUrl: z
    .string()
    .url("有効なURLを入力してください。")
    .or(z.literal(""))
    .optional(),
  overwrite: z.boolean().default(false),
  autoIncrement: z.boolean().default(false),
});

export function UploadMediaModal(props: UploadMediaModalProps) {
  const [filename, setFilename] = createSignal(props.initialFile?.name || "");
  const [description, setDescription] = createSignal("");
  const [sourceUrl, setSourceUrl] = createSignal(props.pastedUrl || "");
  const [overwrite, setOverwrite] = createSignal(false);
  const [autoIncrement, setAutoIncrement] = createSignal(false);
  const [errors, setErrors] = createSignal<z.ZodIssue[]>([]);
  const [isUploading, setIsUploading] = createSignal(false);
  const [isFetchingUrl, setIsFetchingUrl] = createSignal(false);
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.pastedUrl) {
      setSourceUrl(props.pastedUrl);
    }
  });

  // Create preview for initialFile (file selection or image paste)
  createEffect(
    on(
      () => props.initialFile,
      (file) => {
        const currentPreview = previewUrl();
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
          setPreviewUrl(null);
        }

        if (file) {
          const objectUrl = URL.createObjectURL(file);
          setPreviewUrl(objectUrl);
          setFilename(file.name);
        }
      }
    )
  );

  createEffect(
    on(sourceUrl, async (url) => {
      const currentPreview = previewUrl();
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
        setPreviewUrl(null);
      }
      if (url && z.string().url().safeParse(url).success) {
        setIsFetchingUrl(true);
        setErrors([]);
        try {
          const blob = await fetchFromUrl(url);
          const fetchedFile = new File(
            [blob],
            url.substring(url.lastIndexOf("/") + 1) || "fetched-image",
            { type: blob.type }
          );
          props.onUrlFetch(fetchedFile);
          setFilename(fetchedFile.name);
          setPreviewUrl(URL.createObjectURL(fetchedFile));
        } catch (e) {
          setErrors([
            {
              message: (e as Error).message,
              path: ["sourceUrl"],
              code: "custom",
            },
          ]);
        } finally {
          setIsFetchingUrl(false);
        }
      }
    })
  );

  onCleanup(() => {
    const currentPreview = previewUrl();
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
    }
  });

  const handleUpload = async () => {
    setErrors([]);
    const parsed = formSchema.safeParse({
      filename: filename(),
      description: description(),
      sourceUrl: sourceUrl(),
      overwrite: overwrite(),
      autoIncrement: autoIncrement(),
    });

    if (!parsed.success) {
      setErrors(parsed.error.issues);
      return;
    }

    if (!props.initialFile) {
      setErrors([
        {
          message: "アップロードするファイルがありません。",
          path: ["file"],
          code: "custom",
        },
      ]);
      return;
    }

    setIsUploading(true);
    try {
      await props.onUpload({
        file: props.initialFile,
        filename: parsed.data.filename || props.initialFile.name,
        description: parsed.data.description || "",
        sourceUrl: parsed.data.sourceUrl || "",
        overwrite: parsed.data.overwrite,
        autoIncrement: parsed.data.autoIncrement,
      });
      props.onClose();
    } catch (e) {
      setErrors([
        { message: (e as Error).message, path: ["upload"], code: "custom" },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog onOpenChange={props.onClose} open={props.isOpen}>
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>メディアをアップロード</DialogTitle>
          <DialogDescription>
            アップロードするメディアの詳細を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right" for="filename">
              ファイル名
            </Label>
            <Input
              class="col-span-3"
              id="filename"
              onInput={(e) => setFilename(e.currentTarget.value)}
              value={filename()}
            />
            <Show when={errors().find((e) => e.path[0] === "filename")}>
              {(error) => (
                <p class="col-span-4 text-right text-red-500 text-sm">
                  {error().message}
                </p>
              )}
            </Show>
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right" for="description">
              説明
            </Label>
            <Input
              class="col-span-3"
              id="description"
              onInput={(e) => setDescription(e.currentTarget.value)}
              value={description()}
            />
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right" for="sourceUrl">
              ソースURL
            </Label>
            <div class="relative col-span-3">
              <Input
                class="w-full"
                disabled={isFetchingUrl()}
                id="sourceUrl"
                onInput={(e) => setSourceUrl(e.currentTarget.value)}
                value={sourceUrl()}
              />
              <Show when={isFetchingUrl()}>
                <div class="-translate-y-1/2 absolute top-1/2 right-2 text-sm">
                  Loading...
                </div>
              </Show>
            </div>
            <Show when={errors().find((e) => e.path[0] === "sourceUrl")}>
              {(error) => (
                <p class="col-span-4 text-right text-red-500 text-sm">
                  {error().message}
                </p>
              )}
            </Show>
            <Show when={previewUrl()}>
              <div class="col-span-4 mt-2 flex justify-center">
                {/* biome-ignore lint/performance/noImgElement: This is a preview image. */}
                {/* biome-ignore lint/nursery/useImageSize: This is a preview image. */}
                <img
                  alt="Fetched preview"
                  class="max-h-48"
                  src={previewUrl() || undefined}
                />
              </div>
            </Show>
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right" for="overwrite">
              上書き
            </Label>
            <input
              checked={overwrite()}
              class="col-span-3"
              id="overwrite"
              onChange={(e) => setOverwrite(e.currentTarget.checked)}
              type="checkbox"
            />
          </div>
          <div class="grid grid-cols-4 items-center gap-4">
            <Label class="text-right" for="autoIncrement">
              自動連番
            </Label>
            <input
              checked={autoIncrement()}
              class="col-span-3"
              id="autoIncrement"
              onChange={(e) => setAutoIncrement(e.currentTarget.checked)}
              type="checkbox"
            />
          </div>
          <Show when={errors().find((e) => e.path[0] === "upload")}>
            {(error) => (
              <p class="col-span-4 text-center text-red-500 text-sm">
                {error().message}
              </p>
            )}
          </Show>
        </div>
        <DialogFooter>
          <Button disabled={isUploading()} onClick={handleUpload} type="submit">
            {isUploading() ? "アップロード中..." : "アップロード"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
