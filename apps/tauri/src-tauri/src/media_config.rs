use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ComfyUiTagExtractionConfig {
    pub positive_node_types: Vec<String>,
    pub negative_keywords: Vec<String>,
    pub negative_tags: Vec<String>,
}

impl Default for ComfyUiTagExtractionConfig {
    fn default() -> Self {
        Self {
            positive_node_types: vec![
                "CLIPTextEncode".to_string(),
                "CR Combine Prompt".to_string(),
            ],
            negative_keywords: vec!["negative".to_string()],
            negative_tags: vec!["lowres".to_string()],
        }
    }
}
