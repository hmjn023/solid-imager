use chrono::Utc;
use notify::event::{CreateKind, ModifyKind, RemoveKind};
use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceWatchEventPayload {
    media_source_id: String,
    paths: Vec<String>,
    timestamp: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WatcherErrorPayload {
    media_source_id: String,
    error: String,
    timestamp: String,
}

struct SourceWatcher {
    #[allow(dead_code)]
    watcher: notify::RecommendedWatcher,
}

#[derive(Default)]
pub struct WatcherRegistry {
    watchers: Mutex<HashMap<String, SourceWatcher>>,
}

fn should_forward_event(kind: &EventKind) -> bool {
    matches!(
        kind,
        EventKind::Any
            | EventKind::Other
            | EventKind::Create(CreateKind::Any)
            | EventKind::Create(CreateKind::File)
            | EventKind::Create(CreateKind::Folder)
            | EventKind::Create(CreateKind::Other)
            | EventKind::Modify(ModifyKind::Any)
            | EventKind::Modify(ModifyKind::Data(_))
            | EventKind::Modify(ModifyKind::Metadata(_))
            | EventKind::Modify(ModifyKind::Name(_))
            | EventKind::Modify(ModifyKind::Other)
            | EventKind::Remove(RemoveKind::Any)
            | EventKind::Remove(RemoveKind::File)
            | EventKind::Remove(RemoveKind::Folder)
            | EventKind::Remove(RemoveKind::Other)
    )
}

fn emit_watch_event(app: &AppHandle, media_source_id: &str, event: Event) {
    if !should_forward_event(&event.kind) {
        return;
    }

    let paths = event
        .paths
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();

    if paths.is_empty() {
        return;
    }

    let _ = app.emit(
        "source-watch-event",
        SourceWatchEventPayload {
            media_source_id: media_source_id.to_string(),
            paths,
            timestamp: Utc::now().to_rfc3339(),
        },
    );
}

fn emit_watch_error(app: &AppHandle, media_source_id: &str, error: impl std::fmt::Display) {
    let _ = app.emit(
        "watcher-error",
        WatcherErrorPayload {
            media_source_id: media_source_id.to_string(),
            error: error.to_string(),
            timestamp: Utc::now().to_rfc3339(),
        },
    );
}

impl WatcherRegistry {
    fn stop_locked(&self, media_source_id: &str) {
        let watcher = self.watchers.lock().unwrap().remove(media_source_id);
        drop(watcher);
    }

    fn start(
        &self,
        app: AppHandle,
        media_source_id: String,
        watch_path: String,
    ) -> Result<(), String> {
        let path = Path::new(&watch_path);
        if !path.exists() {
            return Err(format!("Source path does not exist: {watch_path}"));
        }

        self.stop_locked(&media_source_id);

        let callback_media_source_id = media_source_id.clone();
        let callback_app = app.clone();
        let mut watcher = recommended_watcher(move |result| match result {
            Ok(event) => emit_watch_event(&callback_app, &callback_media_source_id, event),
            Err(error) => emit_watch_error(&callback_app, &callback_media_source_id, error),
        })
        .map_err(|error| format!("Creating file watcher failed for {watch_path}: {error}"))?;

        watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|error| format!("Watching source failed for {watch_path}: {error}"))?;

        self.watchers
            .lock()
            .unwrap()
            .insert(media_source_id, SourceWatcher { watcher });

        Ok(())
    }

    fn stop(&self, media_source_id: &str) {
        self.stop_locked(media_source_id);
    }
}

#[tauri::command]
pub fn source_watch_start(
    state: State<WatcherRegistry>,
    app: AppHandle,
    media_source_id: String,
    watch_path: String,
) -> Result<(), String> {
    state.start(app, media_source_id, watch_path)
}

#[tauri::command]
pub fn source_watch_stop(state: State<WatcherRegistry>, media_source_id: String) {
    state.stop(&media_source_id);
}
