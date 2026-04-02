// Hedge Coding — Deep Analysis Module
// Calls the configured cheap model to generate one-line file summaries.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

// ─── Cache structures ─────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AnalysisCache {
    pub generated_at: String,
    pub folder_path: String,
    /// relative_path → one-line summary
    pub summaries: HashMap<String, String>,
}

// ─── Model config (read from models.json) ────────────

#[derive(Deserialize, Debug)]
struct ModelConfig {
    #[serde(rename = "modelId")]
    model_id: String,
    #[serde(rename = "baseUrl")]
    base_url: String,
    #[serde(rename = "apiKey", default)]
    api_key: String,
}

// ─── OpenAI-compat request/response types ────────────

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    /// Real usage reported by the API (may be absent in some providers)
    usage: Option<ApiUsage>,
}

#[derive(Deserialize)]
struct ApiUsage {
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

/// Token usage for a single summarize_file call.
pub struct TokenUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

// ─── Public API ───────────────────────────────────────

/// Read models.json from the project directory and validate it has an API key.
/// Returns (model_id, base_url, api_key) or an error message.
pub fn read_model_config(_project_dir: &PathBuf) -> Result<(String, String, String), String> {
    let models_path = dirs::home_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())?
        .join(".HedgeCoding")
        .join("models.json");
    let content = std::fs::read_to_string(&models_path)
        .map_err(|_| "models.json not found at ~/.HedgeCoding/models.json".to_string())?;

    // Strip trailing commas (same as server.rs)
    let cleaned = strip_trailing_commas(&content);

    // Try object first, then array
    let cfg: ModelConfig = serde_json::from_str::<ModelConfig>(&cleaned)
        .or_else(|_| {
            serde_json::from_str::<Vec<ModelConfig>>(&cleaned)
                .map_err(|e| e.to_string())?
                .into_iter()
                .next()
                .ok_or_else(|| "models.json is empty".to_string())
        })
        .map_err(|e| format!("Failed to parse models.json: {}", e))?;

    if cfg.api_key.is_empty() {
        return Err("Budget model API key is not configured in models.json".to_string());
    }

    Ok((cfg.model_id, cfg.base_url, cfg.api_key))
}

/// Summarize a single file's content using the cheap model.
/// Returns (summary, TokenUsage) or an error.
pub fn summarize_file(
    filename: &str,
    content: &str,
    model_id: &str,
    base_url: &str,
    api_key: &str,
) -> Result<(String, TokenUsage), String> {
    // Truncate very large files to keep cost low (~4K bytes ≈ ~1K tokens).
    let truncated = if content.len() > 4000 {
        let mut end = 4000;
        while end > 0 && !content.is_char_boundary(end) { end -= 1; }
        &content[..end]
    } else {
        content
    };

    let prompt = format!(
        "Summarize this source file in one concise sentence for a developer. \
         Focus on what it does, not how. Reply with the summary only, no extra text.\n\n\
         File: {}\n\nContent:\n{}",
        filename, truncated
    );

    // Estimate input tokens before the call (fallback if API doesn't return usage)
    let est_input = ((prompt.len() + 40) / 4) as u32; // +40 for system overhead

    let request = ChatRequest {
        model: model_id.to_string(),
        messages: vec![
            ChatMessage {
                role: "user".to_string(),
                content: prompt,
            }
        ],
        max_tokens: 120,
        temperature: 0.0,
    };

    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .map_err(|e| {
            if e.is_timeout() { "Model timeout — no response after 30s".to_string() }
            else if e.is_connect() { "Network error — cannot reach model API".to_string() }
            else { format!("Request failed: {}", e) }
        })?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().unwrap_or_default();
        if status == 401 || status == 403 {
            return Err("API key rejected — check your key in models.json".to_string());
        }
        return Err(format!("API error {}: {}", status, &body[..body.len().min(200)]));
    }

    let chat_resp: ChatResponse = response
        .json()
        .map_err(|e| format!("Invalid API response format: {}", e))?;

    // Prefer real usage from API, fall back to estimate
    let usage = TokenUsage {
        input_tokens: chat_resp.usage
            .as_ref()
            .and_then(|u| u.prompt_tokens)
            .unwrap_or(est_input),
        output_tokens: chat_resp.usage
            .as_ref()
            .and_then(|u| u.completion_tokens)
            .unwrap_or(0),
    };

    let summary = chat_resp
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content.trim().to_string())
        .unwrap_or_else(|| "No summary returned".to_string());

    // Estimate output tokens from actual summary length
    let usage = TokenUsage {
        output_tokens: if usage.output_tokens == 0 {
            (summary.len() / 4) as u32
        } else {
            usage.output_tokens
        },
        ..usage
    };

    // Strip CoT reasoning tags (DeepSeek-R1 / Minimax output)
    let summary = strip_think_tags(&summary);

    Ok((summary, usage))
}

/// Ask the budget model to select the most relevant files for a given goal.
/// Returns a list of relative file paths. If the model is not available or
/// returns invalid output, returns an empty Vec (caller should fall back to all files).
#[allow(dead_code)]
pub fn smart_select_files(
    goal: &str,
    file_summaries: &str,
    model_id: &str,
    base_url: &str,
    api_key: &str,
) -> Result<Vec<String>, String> {
    let prompt = format!(
        "You are a code-aware file selector. Given a developer's goal and a map of \
         all project files with semantic descriptions, identify the files most relevant \
         to accomplishing the goal.\n\n\
         Rules:\n\
         - Select 5-20 files maximum.\n\
         - Include files that will likely need modification.\n\
         - Include direct dependencies of files being modified.\n\
         - Do NOT include unrelated files unless the goal specifically targets them.\n\n\
         Respond with ONLY a JSON array of relative file paths, nothing else. \
         Example: [\"src/main.rs\", \"src/server.rs\"]\n\n\
         Goal: {}\n\n\
         File map:\n{}",
        goal, file_summaries
    );

    let request = ChatRequest {
        model: model_id.to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        max_tokens: 1000,
        temperature: 0.0,
    };

    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .map_err(|e| format!("Smart select request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Smart select API error: {}", response.status()));
    }

    let chat_resp: ChatResponse = response
        .json()
        .map_err(|e| format!("Invalid smart select response: {}", e))?;

    let raw = chat_resp
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content.trim().to_string())
        .unwrap_or_default();

    // Strip CoT reasoning tags (DeepSeek-R1 / Minimax output)
    let cleaned = strip_think_tags(&raw);

    // Extract JSON array from response (may be wrapped in markdown code fences)
    let json_str = extract_json_array(&cleaned);

    // Parse as Vec<String>
    let paths: Vec<String> = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse file selection JSON: {} — raw: {}", e, &json_str[..json_str.len().min(200)]))?;

    Ok(paths)
}

// ─── Task Classifier + Goal Refiner ───────────────────

/// Result of the classify_and_refine step.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TaskClassification {
    /// "SMALL", "MEDIUM", or "LARGE"
    pub size: String,
    /// Refined, precise version of the user's goal
    pub refined_goal: String,
    /// Files the budget model recommends modifying
    pub target_files: Vec<String>,
    /// Task-specific execution notes generated by the budget model.
    /// 2-4 concrete, file-specific warnings/guidance for THIS task only.
    /// Empty string if the model did not produce any (treated as optional).
    #[serde(default)]
    pub task_instructions: String,
    /// IDs of skills the budget model considers relevant to THIS task.
    /// Subset of the available skills passed in. Empty = use all user-selected skills.
    #[serde(default)]
    pub relevant_skill_ids: Vec<String>,
}

/// Ask the budget model to classify task complexity and refine the user's goal.
/// Uses only the repo map (file names + symbols) — does NOT need Deep Analysis.
/// `skills_meta` is an optional formatted list of available skills (id: name — description).
/// Returns TaskClassification or an error (caller falls back to full mode).
pub fn classify_and_refine(
    goal: &str,
    repo_map: &str,
    model_id: &str,
    base_url: &str,
    api_key: &str,
    skills_meta: Option<&str>,
) -> Result<TaskClassification, String> {
    // Build the optional skills section of the prompt
    let skills_section = match skills_meta {
        Some(meta) if !meta.trim().is_empty() => format!(
            "\n         5. FILTER SKILLS — from the available skills below, select ONLY those directly \n\
              relevant to this specific task. If none are relevant, return an empty array.\n\
              Rules: include a skill only if it would change how you implement this task;\n\
              exclude general skills that always apply (they are auto-injected separately).\n\
              Return the skill IDs as: \"relevant_skill_ids\":[\"id1\",\"id2\"]\n\n\
              Available skills:\n{}",
            meta
        ),
        _ => String::new(),
    };

    // Build example JSON (include relevant_skill_ids field only when skills are present)
    let example_json = if skills_meta.map(|s| !s.trim().is_empty()).unwrap_or(false) {
        r#"{"size":"SMALL","refined_goal":"...","target_files":["path/to/file"],"task_instructions":"1. ...\n2. ...","relevant_skill_ids":["skill-id"]}"#
    } else {
        r#"{"size":"SMALL","refined_goal":"...","target_files":["path/to/file"],"task_instructions":"1. ...\n2. ..."}"#
    };

    let prompt = format!(
        "You are a senior developer assistant analyzing a coding task.\n\n\
         Given the user's goal and a project file map, do FOUR things (plus a fifth if skills are listed):\n\n\
         1. CLASSIFY the task complexity:\n\
            - SMALL: UI tweaks, style changes, text changes, config edits, simple bug fixes (affects 1-3 files)\n\
            - MEDIUM: New features, component additions, multi-file refactors (affects 4-15 files)\n\
            - LARGE: Architecture changes, major rewrites, cross-cutting concerns (affects 15+ files)\n\n\
         2. REFINE the goal into a precise, actionable instruction. Reference specific function names, \n\
            CSS class names, or component names from the file map where possible.\n\n\
         3. LIST the exact files that need modification (relative paths from the file map).\n\
            SMALL: 1-5 files. MEDIUM: 5-15 files. LARGE: all relevant files.\n\n\
         4. WRITE 2-4 task-specific execution notes for THIS exact task only.\n\
            - Reference actual file names and function/variable names from the file map.\n\
            - Warn about non-obvious side effects, shared data structures, or coupling risks.\n\
            - Flag any patterns or conventions in the codebase the implementer must follow.\n\
            - DO NOT write generic advice like 'read before you write' or 'test your changes'.\n\
            - Example good note: 'CompileOptions in compiler.rs is shared by compile() and compile_review() — adding a field requires updating both callers in server.rs'\n\
            - Example bad note: 'Be careful with the changes' or 'Make sure it works'\n\
            Format as a numbered list, e.g. '1. ...\\n2. ...'{}\
\n\
         Respond with ONLY valid JSON, no markdown fences:\n\
         {}\n\n\
         User goal: {}\n\n\
         File map:\n{}",
        skills_section, example_json, goal, repo_map
    );

    let request = ChatRequest {
        model: model_id.to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        max_tokens: 2500,
        temperature: 0.0,
    };

    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let response = client
        .post(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .map_err(|e| format!("Classify request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Classify API error: {}", response.status()));
    }

    let chat_resp: ChatResponse = response
        .json()
        .map_err(|e| format!("Invalid classify response: {}", e))?;

    let raw = chat_resp
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content.trim().to_string())
        .unwrap_or_default();

    // Strip CoT reasoning tags
    let cleaned = strip_think_tags(&raw);

    // Extract JSON object from response
    let json_str = extract_json_object(&cleaned);

    let classification: TaskClassification = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse classification JSON: {} — raw: {}", e, &json_str[..json_str.len().min(300)]))?;

    // Validate size field
    let valid_sizes = ["SMALL", "MEDIUM", "LARGE"];
    if !valid_sizes.contains(&classification.size.as_str()) {
        return Err(format!("Invalid task size: {}", classification.size));
    }

    Ok(classification)
}

/// Extract a JSON object {...} from text that may contain markdown fences or extra text.
fn extract_json_object(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        return trimmed.to_string();
    }
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if start < end {
                return trimmed[start..=end].to_string();
            }
        }
    }
    trimmed.to_string()
}

/// Strip <think>...</think> reasoning tags from model output.
fn strip_think_tags(input: &str) -> String {
    let mut result = input.to_string();
    while let Some(start) = result.find("<think>") {
        if let Some(end) = result.find("</think>") {
            if start < end {
                result.replace_range(start..end + 8, "");
            } else {
                break;
            }
        } else {
            result.replace_range(start.., "");
            break;
        }
    }
    result.replace("</think>", "").trim().to_string()
}

/// Extract a JSON array from text that may contain markdown code fences.
#[allow(dead_code)]
fn extract_json_array(input: &str) -> String {
    let trimmed = input.trim();
    // Already a JSON array
    if trimmed.starts_with('[') {
        return trimmed.to_string();
    }
    // Wrapped in ```json ... ``` or ``` ... ```
    if let Some(start) = trimmed.find('[') {
        if let Some(end) = trimmed.rfind(']') {
            if start <= end {
                return trimmed[start..=end].to_string();
            }
        }
    }
    trimmed.to_string()
}

// ─── Cache I/O ────────────────────────────────────────

/// Save analysis cache to {project_dir}/.hedgecoding/analysis_cache.json
pub fn save_cache(project_dir: &PathBuf, cache: &AnalysisCache) -> Result<(), String> {
    let hc_dir = project_dir.join(".hedgecoding");
    std::fs::create_dir_all(&hc_dir)
        .map_err(|e| format!("Failed to create .hedgecoding dir: {}", e))?;

    let cache_path = hc_dir.join("analysis_cache.json");
    let json = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize cache: {}", e))?;

    std::fs::write(&cache_path, json)
        .map_err(|e| format!("Failed to write cache file: {}", e))?;

    Ok(())
}

/// Load analysis cache from {project_dir}/.hedgecoding/analysis_cache.json
/// Returns None if file does not exist.
pub fn load_cache(project_dir: &PathBuf) -> Result<Option<AnalysisCache>, String> {
    let cache_path = project_dir.join(".hedgecoding").join("analysis_cache.json");

    if !cache_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&cache_path)
        .map_err(|e| format!("Failed to read cache file: {}", e))?;

    let cache: AnalysisCache = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse cache file: {}", e))?;

    Ok(Some(cache))
}

// ─── Helpers ──────────────────────────────────────────

fn strip_trailing_commas(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut i = 0;
    while i < len {
        if chars[i] == ',' {
            let mut j = i + 1;
            while j < len && (chars[j] == ' ' || chars[j] == '\t' || chars[j] == '\n' || chars[j] == '\r') {
                j += 1;
            }
            if j < len && (chars[j] == '}' || chars[j] == ']') {
                i += 1;
                continue;
            }
        }
        result.push(chars[i]);
        i += 1;
    }
    result
}
