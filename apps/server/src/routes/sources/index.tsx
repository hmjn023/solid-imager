import type {
  MediaSourceInfo,
  SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";
import toast from "solid-toast";
import SourceCard from "~/components/source-card";
import SourceDeleteModal from "~/components/source-delete-modal";
import SourceFormModal from "~/components/source-form-modal";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import {
  createMediaSource,
  deleteMediaSource,
  fetchMediaSources,
  updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import { logger } from "~/infrastructure/logger";

const UUID_PREFIX_LENGTH = 4;

/**
 * The main component for managing media sources.
 * It displays a list of media sources, and provides functionality to add, edit, and delete them.
 * @returns {JSX.Element} The rendered media sources management page.
 */
export default function Sources() {
  const [showFormModal, setShowFormModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingSource, setEditingSource] = createSignal<
    SafeMediaSource | MediaSourceInfo | null
  >(null);
  const [deletingSource, setDeletingSource] = createSignal<
    SafeMediaSource | MediaSourceInfo | null
  >(null);

  const queryClient = useQueryClient();
  const mediaSources = createQuery(() => ({
    queryKey: ["mediaSources"],
    queryFn: fetchMediaSources,
  }));

  const handleAddSource = () => {
    setEditingSource(null);
    setShowFormModal(true);
  };

  const handleEditSource = (source: SafeMediaSource | MediaSourceInfo) => {
    setEditingSource(source);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (sourceData: unknown) => {
    const editing = editingSource();
    try {
      if (editing?.id) {
        // biome-ignore lint/suspicious/noExplicitAny: Temporary fix for type mismatch
        await updateMediaSource(editing.id, sourceData as any);
      } else {
        // biome-ignore lint/suspicious/noExplicitAny: Temporary fix for type mismatch
        await createMediaSource(sourceData as any);
      }
      await queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
      setShowFormModal(false);
    } catch (error) {
      logger.error({ err: error }, "Failed to submit source form");
    }
  };

  const handleDeleteSource = (source: SafeMediaSource | MediaSourceInfo) => {
    setDeletingSource(source);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (mediaSourceId: string) => {
    try {
      await deleteMediaSource(mediaSourceId);
      await queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
      setShowDeleteModal(false);
      setDeletingSource(null);
    } catch (error) {
      logger.error(
        { err: error, mediaSourceId },
        "Failed to delete media source"
      );
    }
  };

  // SSE setup using oRPC
  onMount(() => {
    if (isServer) {
      return;
    }

    // Watch for changes in mediaSources data and setup SSE
    createEffect(() => {
      const sources = mediaSources.data;
      if (!sources) {
        return;
      }

      // Create a controller for this effect run (cancels previous run's streams)
      const ac = new AbortController();

      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE handler logic
      const startStreamForSource = async (id: string) => {
        try {
          const events = await orpc.sources.events(
            { id },
            { signal: ac.signal }
          );

          for await (const msg of events) {
            if (ac.signal.aborted) {
              break;
            }

            const { event, data } = msg;

            switch (event) {
              case "all-jobs-completed":
                toast.success(
                  `Jobs for source ${id.substring(
                    0,
                    UUID_PREFIX_LENGTH
                  )}... completed! Processed: ${data?.processed}`
                );
                queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
                break;
              case "watcher-error":
                toast.error(
                  `Watcher Error for ${id.substring(
                    0,
                    UUID_PREFIX_LENGTH
                  )}...: ${data?.error || "Unknown error"}`
                );
                break;
              default:
                break;
            }
          }
        } catch (err) {
          if (!ac.signal.aborted) {
            logger.error({ err }, "Event stream error");
          }
        }
      };

      for (const source of sources) {
        if (source.id) {
          startStreamForSource(source.id);
        }
      }

      // Cleanup function run before next effect or on unmount
      onCleanup(() => {
        ac.abort();
      });
    });
  });

  return (
    <div class="container mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="font-bold text-3xl">Media Sources</h1>
        <button
          class="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={() => handleAddSource()}
          type="button"
        >
          Add Source
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <For each={mediaSources.data}>
          {(source) => (
            <SourceCard
              mediaSource={source}
              onDelete={handleDeleteSource}
              onEdit={handleEditSource}
            />
          )}
        </For>
      </div>

      {mediaSources.isLoading && (
        <div class="mt-8 text-center">
          <p class="text-muted-foreground">Loading sources...</p>
        </div>
      )}

      {mediaSources.isError && (
        <div class="mt-8 text-center">
          <p class="text-red-500">
            Error loading sources: {mediaSources.error?.message}
          </p>
        </div>
      )}

      <SourceFormModal
        editingSource={editingSource()}
        isOpen={showFormModal()}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
      />

      <SourceDeleteModal
        isOpen={showDeleteModal()}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        sourceToDelete={deletingSource()}
      />
    </div>
  );
}
