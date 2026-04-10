use crate::backend::types::ComfyUiTagExtractionConfig;
use crate::commands::utils::{ExtractMetadataResult, ExtractedTag};
use serde_json::{Map, Value};
use std::fs;
use std::io::{Cursor, Read};

const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

struct MetadataComment {
    keyword: String,
    text: String,
}

pub fn extract_metadata_from_path(
    media_path: &str,
    config: &ComfyUiTagExtractionConfig,
) -> Result<ExtractMetadataResult, String> {
    let comments = extract_comments_from_path(media_path)?;
    Ok(extract_data_from_comments(&comments, config))
}

fn extract_comments_from_path(media_path: &str) -> Result<Vec<MetadataComment>, String> {
    let bytes = fs::read(media_path)
        .map_err(|error| format!("Reading image metadata failed for {media_path}: {error}"))?;
    if bytes.starts_with(&PNG_SIGNATURE) {
        return extract_png_comments(&bytes);
    }

    Ok(Vec::new())
}

fn extract_png_comments(bytes: &[u8]) -> Result<Vec<MetadataComment>, String> {
    let mut cursor = Cursor::new(bytes);
    let mut signature = [0_u8; 8];
    cursor
        .read_exact(&mut signature)
        .map_err(|error| format!("Reading PNG signature failed: {error}"))?;

    let mut comments = Vec::new();
    while (cursor.position() as usize) + 8 <= bytes.len() {
        let length = read_u32_be(&mut cursor)? as usize;
        let chunk_type = read_chunk_type(&mut cursor)?;
        if (cursor.position() as usize) + length + 4 > bytes.len() {
            break;
        }

        let mut data = vec![0_u8; length];
        cursor
            .read_exact(&mut data)
            .map_err(|error| format!("Reading PNG chunk data failed: {error}"))?;
        let mut crc = [0_u8; 4];
        cursor
            .read_exact(&mut crc)
            .map_err(|error| format!("Reading PNG CRC failed: {error}"))?;

        match chunk_type.as_str() {
            "tEXt" => {
                if let Some(comment) = parse_png_text_chunk(&data) {
                    comments.push(comment);
                }
            }
            "iTXt" => {
                if let Some(comment) = parse_png_itxt_chunk(&data) {
                    comments.push(comment);
                }
            }
            "IEND" => break,
            _ => {}
        }
    }

    Ok(comments)
}

fn read_u32_be(cursor: &mut Cursor<&[u8]>) -> Result<u32, String> {
    let mut buf = [0_u8; 4];
    cursor
        .read_exact(&mut buf)
        .map_err(|error| format!("Reading PNG integer failed: {error}"))?;
    Ok(u32::from_be_bytes(buf))
}

fn read_chunk_type(cursor: &mut Cursor<&[u8]>) -> Result<String, String> {
    let mut buf = [0_u8; 4];
    cursor
        .read_exact(&mut buf)
        .map_err(|error| format!("Reading PNG chunk type failed: {error}"))?;
    String::from_utf8(buf.to_vec()).map_err(|error| format!("Invalid PNG chunk type: {error}"))
}

fn parse_png_text_chunk(data: &[u8]) -> Option<MetadataComment> {
    let separator = data.iter().position(|value| *value == 0)?;
    let keyword = String::from_utf8(data[..separator].to_vec()).ok()?;
    let text = String::from_utf8(data[separator + 1..].to_vec()).ok()?;
    Some(MetadataComment { keyword, text })
}

fn parse_png_itxt_chunk(data: &[u8]) -> Option<MetadataComment> {
    let mut sections = data.splitn(6, |value| *value == 0);
    let keyword = String::from_utf8(sections.next()?.to_vec()).ok()?;
    let compression_flag = *sections.next()?.first()?;
    if compression_flag != 0 {
        return None;
    }
    let _compression_method = sections.next()?;
    let _language_tag = sections.next()?;
    let _translated_keyword = sections.next()?;
    let text = String::from_utf8(sections.next()?.to_vec()).ok()?;
    Some(MetadataComment { keyword, text })
}

fn extract_data_from_comments(
    comments: &[MetadataComment],
    config: &ComfyUiTagExtractionConfig,
) -> ExtractMetadataResult {
    let mut tags = Vec::new();
    let mut prompt = None;
    let mut workflow = None;

    for chunk in comments {
        let processed = process_comment_chunk(chunk, config);
        tags.extend(processed.tags);
        if let Some(value) = processed.prompt {
            prompt = Some(value);
        }
        if let Some(value) = processed.workflow {
            workflow = Some(value);
        }
    }

    tags.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then(left.tag_type.cmp(right.tag_type))
    });
    tags.dedup_by(|left, right| left.name == right.name && left.tag_type == right.tag_type);

    ExtractMetadataResult {
        tags,
        prompt,
        workflow,
    }
}

struct ProcessedChunk {
    tags: Vec<ExtractedTag>,
    prompt: Option<Value>,
    workflow: Option<Value>,
}

fn process_comment_chunk(
    chunk: &MetadataComment,
    config: &ComfyUiTagExtractionConfig,
) -> ProcessedChunk {
    if chunk.keyword == "prompt" {
        if let Ok(parsed_json) = serde_json::from_str::<Value>(&chunk.text) {
            if looks_like_workflow(&parsed_json) {
                let tags = extract_tags_from_workflow(&parsed_json, config);
                return ProcessedChunk {
                    tags,
                    prompt: Some(Value::String(chunk.text.clone())),
                    workflow: Some(parsed_json),
                };
            }
        }

        return ProcessedChunk {
            tags: Vec::new(),
            prompt: Some(Value::String(chunk.text.clone())),
            workflow: None,
        };
    }

    if chunk.keyword == "workflow" {
        if let Ok(parsed_json) = serde_json::from_str::<Value>(&chunk.text) {
            let tags = extract_tags_from_workflow(&parsed_json, config);
            return ProcessedChunk {
                tags,
                prompt: None,
                workflow: Some(parsed_json),
            };
        }
    }

    ProcessedChunk {
        tags: Vec::new(),
        prompt: None,
        workflow: None,
    }
}

fn looks_like_workflow(value: &Value) -> bool {
    if let Some(object) = value.as_object() {
        if object.contains_key("nodes") {
            return true;
        }

        return object.values().take(5).any(|item| {
            item.as_object()
                .is_some_and(|node| node.contains_key("class_type"))
        });
    }

    false
}

fn extract_tags_from_workflow(
    workflow: &Value,
    config: &ComfyUiTagExtractionConfig,
) -> Vec<ExtractedTag> {
    let mut positive_tags = Vec::new();
    let mut negative_tags = Vec::new();

    let nodes = if let Some(nodes) = workflow.get("nodes").and_then(Value::as_array) {
        nodes.clone()
    } else if let Some(object) = workflow.as_object() {
        object.values().cloned().collect()
    } else {
        Vec::new()
    };

    for node in nodes {
        process_workflow_node(&node, config, &mut positive_tags, &mut negative_tags);
    }

    positive_tags.extend(negative_tags);
    positive_tags
}

fn process_workflow_node(
    node: &Value,
    config: &ComfyUiTagExtractionConfig,
    positive_tags: &mut Vec<ExtractedTag>,
    negative_tags: &mut Vec<ExtractedTag>,
) {
    let Some(node_object) = node.as_object() else {
        return;
    };

    let node_type = node_object
        .get("type")
        .and_then(Value::as_str)
        .or_else(|| node_object.get("class_type").and_then(Value::as_str));

    let is_positive_node = node_type.is_some_and(|node_type| {
        config
            .positive_node_types
            .iter()
            .any(|allowed| allowed == node_type)
    });
    if !is_positive_node {
        return;
    }

    let node_title = node_object
        .get("title")
        .and_then(Value::as_str)
        .or_else(|| {
            node_object
                .get("_meta")
                .and_then(Value::as_object)
                .and_then(|meta| meta.get("title"))
                .and_then(Value::as_str)
        });

    let mut values_to_process = Vec::new();
    if let Some(values) = node_object.get("widgets_values").and_then(Value::as_array) {
        values_to_process.extend(values.iter().cloned());
    }
    if let Some(inputs) = node_object.get("inputs").and_then(Value::as_object) {
        values_to_process.extend(inputs.values().cloned());
    }

    for widget_value in values_to_process {
        let (new_positive_tags, new_negative_tags) =
            process_widget_value_tags(&widget_value, node_title, config);
        positive_tags.extend(new_positive_tags);
        negative_tags.extend(new_negative_tags);
    }
}

fn process_widget_value_tags(
    widget_value: &Value,
    node_title: Option<&str>,
    config: &ComfyUiTagExtractionConfig,
) -> (Vec<ExtractedTag>, Vec<ExtractedTag>) {
    let Some(text) = widget_value.as_str() else {
        return (Vec::new(), Vec::new());
    };

    let tags = text
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.replace(' ', "_").replace('"', ""))
        .collect::<Vec<_>>();
    if tags.is_empty() {
        return (Vec::new(), Vec::new());
    }

    let is_negative_by_title = node_title.is_some_and(|title| {
        let title = title.to_ascii_lowercase();
        config
            .negative_keywords
            .iter()
            .any(|keyword| title.contains(&keyword.to_ascii_lowercase()))
    });
    let is_negative_by_tag = tags
        .iter()
        .any(|tag| config.negative_tags.iter().any(|value| value == tag));

    if is_negative_by_title || is_negative_by_tag {
        return (
            Vec::new(),
            tags.into_iter()
                .map(|name| ExtractedTag {
                    name,
                    tag_type: "negative",
                })
                .collect(),
        );
    }

    (
        tags.into_iter()
            .map(|name| ExtractedTag {
                name,
                tag_type: "positive",
            })
            .collect(),
        Vec::new(),
    )
}

pub fn stringify_prompt_value(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) => Some(text.clone()),
        Some(other) => Some(other.to_string()),
        None => None,
    }
}

pub fn workflow_to_json_text(value: Option<&Value>) -> Option<String> {
    value.and_then(|workflow| match workflow {
        Value::Null => None,
        other => Some(other.to_string()),
    })
}

pub fn has_extracted_metadata(metadata: &ExtractMetadataResult) -> bool {
    !metadata.tags.is_empty() || metadata.prompt.is_some() || metadata.workflow.is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> ComfyUiTagExtractionConfig {
        ComfyUiTagExtractionConfig {
            positive_node_types: vec![
                "CLIPTextEncode".to_string(),
                "CR Combine Prompt".to_string(),
            ],
            negative_keywords: vec!["negative".to_string()],
            negative_tags: vec!["lowres".to_string()],
        }
    }

    #[test]
    fn extracts_prompt_workflow_and_tags_from_comments() {
        let comments = vec![
            MetadataComment {
                keyword: "prompt".to_string(),
                text: serde_json::json!({
                    "nodes": [
                        {
                            "type": "CR Combine Prompt",
                            "widgets_values": ["1girl, solo, smile"],
                            "title": "Positive Prompt"
                        }
                    ]
                })
                .to_string(),
            },
            MetadataComment {
                keyword: "workflow".to_string(),
                text: serde_json::json!({
                    "nodes": [
                        {
                            "type": "CR Combine Prompt",
                            "widgets_values": ["bad anatomy, ugly, disfigured"],
                            "title": "Negative Prompt"
                        }
                    ]
                })
                .to_string(),
            },
        ];

        let result = extract_data_from_comments(&comments, &config());

        assert_eq!(result.tags.len(), 6);
        assert!(result.prompt.is_some());
        assert!(result.workflow.is_some());
    }

    #[test]
    fn parses_png_text_chunks() {
        let data = build_png_with_text_chunks(&[
            ("prompt", "{\"nodes\":[]}"),
            ("workflow", "{\"nodes\":[]}"),
        ]);

        let comments = extract_png_comments(&data).expect("png comments");

        assert_eq!(comments.len(), 2);
        assert_eq!(comments[0].keyword, "prompt");
        assert_eq!(comments[1].keyword, "workflow");
    }

    fn build_png_with_text_chunks(entries: &[(&str, &str)]) -> Vec<u8> {
        let mut bytes = PNG_SIGNATURE.to_vec();
        bytes.extend(make_chunk("IHDR", &[0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
        for (keyword, text) in entries {
            let mut payload = keyword.as_bytes().to_vec();
            payload.push(0);
            payload.extend(text.as_bytes());
            bytes.extend(make_chunk("tEXt", &payload));
        }
        bytes.extend(make_chunk("IEND", &[]));
        bytes
    }

    fn make_chunk(chunk_type: &str, payload: &[u8]) -> Vec<u8> {
        let mut chunk = Vec::new();
        chunk.extend((payload.len() as u32).to_be_bytes());
        chunk.extend(chunk_type.as_bytes());
        chunk.extend(payload);
        chunk.extend([0, 0, 0, 0]);
        chunk
    }
}
