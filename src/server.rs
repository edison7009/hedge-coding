use crate::compiler;
use crate::parser;
use crate::repo_map;
use crate::scanner;
use crate::token_counter;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Shared app state — holds the project directory
pub struct AppState {
    pub project_dir: Mutex<PathBuf>,
}

// ─── IPC Response Types ──────────────────────────────

#[derive(Serialize)]
struct FileInfo {
    relative_path: String,
    size: u64,
    extension: String,
    symbols: Vec<parser::Symbol>,
    line_count: usize,
}

#[derive(Serialize)]
struct ScanResponse {
    root: String,
    files: Vec<FileInfo>,
    total_scanned: usize,
    skipped: Vec<String>,
}

#[derive(Serialize)]
struct CompileResponse {
    super_prompt: String,
    file_count: usize,
    source_chars: usize,
    estimate: token_counter::TokenEstimate,
}

#[derive(Serialize)]
struct ModelInfo {
    name: String,
    model_id: String,
    base_url: String,
    configured: bool,
}

#[derive(Deserialize)]
struct ModelConfig {
    name: String,
    #[serde(rename = "modelId")]
    model_id: String,
    #[serde(rename = "baseUrl")]
    base_url: String,
    #[serde(rename = "apiKey", default)]
    api_key: String,
}

// ─── IPC Commands ────────────────────────────────────

#[tauri::command]
fn scan_project(state: State<'_, AppState>) -> Result<ScanResponse, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;

    let scan_result = scanner::scan_directory(&dir).map_err(|e| e.to_string())?;
    let repo_map = repo_map::generate_repo_map(&dir, &scan_result.files).map_err(|e| e.to_string())?;

    let files: Vec<FileInfo> = scan_result
        .files
        .iter()
        .map(|f| {
            let file_syms = repo_map
                .files
                .iter()
                .find(|fs| fs.relative_path == f.relative_path);

            FileInfo {
                relative_path: f.relative_path.clone(),
                size: f.size,
                extension: f.extension.clone(),
                symbols: file_syms.map(|fs| fs.symbols.clone()).unwrap_or_default(),
                line_count: file_syms.map(|fs| fs.line_count).unwrap_or(0),
            }
        })
        .collect();

    Ok(ScanResponse {
        root: dir.display().to_string(),
        files,
        total_scanned: scan_result.total_scanned,
        skipped: scan_result.skipped,
    })
}

#[tauri::command]
fn compile_prompt(
    goal: String,
    selected_files: Vec<String>,
    checklist: Option<String>,
    state: State<'_, AppState>,
) -> Result<CompileResponse, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;

    let scan_result = scanner::scan_directory(&dir).map_err(|e| e.to_string())?;
    let repo_map = repo_map::generate_repo_map(&dir, &scan_result.files).map_err(|e| e.to_string())?;

    let selected: Vec<_> = scan_result
        .files
        .iter()
        .filter(|f| selected_files.contains(&f.relative_path))
        .cloned()
        .collect();

    let checklist_ref = checklist.as_deref();

    let options = compiler::CompileOptions {
        goal: &goal,
        selected_files: &selected,
        repo_map: &repo_map,
        checklist: checklist_ref,
        skills_context: None,
    };

    let super_prompt = compiler::compile(&options).map_err(|e| e.to_string())?;
    let estimate = token_counter::estimate_cost(&super_prompt.content);

    Ok(CompileResponse {
        super_prompt: super_prompt.content,
        file_count: super_prompt.file_count,
        source_chars: super_prompt.source_chars,
        estimate,
    })
}

#[tauri::command]
fn get_model(state: State<'_, AppState>) -> Result<ModelInfo, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let models_path = dir.join("models.json");

    let content = std::fs::read_to_string(&models_path)
        .map_err(|_| "models.json not found".to_string())?;

    let cleaned = strip_trailing_commas(&content);

    let model: ModelConfig = serde_json::from_str::<ModelConfig>(&cleaned)
        .or_else(|_| {
            serde_json::from_str::<Vec<ModelConfig>>(&cleaned)
                .map(|v| v.into_iter().next().unwrap_or_else(|| ModelConfig {
                    name: "Not configured".to_string(),
                    model_id: String::new(),
                    base_url: String::new(),
                    api_key: String::new(),
                }))
        })
        .map_err(|e| format!("Failed to parse models.json: {}", e))?;

    Ok(ModelInfo {
        name: model.name,
        model_id: model.model_id,
        base_url: model.base_url,
        configured: !model.api_key.is_empty(),
    })
}

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

// ─── Tauri App Builder ───────────────────────────────

pub fn start_ui(project_dir: PathBuf) -> anyhow::Result<()> {
    tauri::Builder::default()
        .manage(AppState {
            project_dir: Mutex::new(project_dir),
        })
        .invoke_handler(tauri::generate_handler![
            scan_project,
            compile_prompt,
            get_model,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|e| anyhow::anyhow!("Error while running tauri application: {}", e))?;
        
    Ok(())
}
