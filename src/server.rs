use crate::analyzer;
use crate::compiler::{self, ReviewCompileOptions, DocCompileOptions, DocFormat};
use crate::git_intel;
use crate::parser;
use crate::repo_map::{self, render_repo_map};
use crate::scanner;
use crate::watcher;

use crate::token_counter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, State};
use tauri_plugin_dialog::DialogExt;

/// Shared app state �?holds the project directory
pub struct AppState {
    pub project_dir: Mutex<PathBuf>,
    pub analysis_cancelled: std::sync::atomic::AtomicBool,
    pub watcher_tx: Mutex<std::sync::mpsc::Sender<PathBuf>>,
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
    /// Absolute path to the saved .md prompt file
    prompt_path: String,
    file_count: usize,
    source_chars: usize,
    estimate: token_counter::TokenEstimate,
    /// Whether smart selection was triggered
    smart_selected: bool,
    /// Total files before smart selection
    total_files: usize,
    /// Task classification: "SMALL", "MEDIUM", "LARGE", or "" if classifier failed
    task_size: String,
    /// Refined goal from budget model, or original goal if classifier failed
    refined_goal: String,
    /// Deep Analysis coverage: "full", "partial", or "none"
    deep_analysis_coverage: String,
    /// Number of files with Deep Analysis summaries
    deep_analysis_files: usize,
}

#[derive(Serialize)]
struct GitStatusResponse {
    files_changed: usize,
    insertions: usize,
    deletions: usize,
}


#[derive(Serialize)]
struct DocsCompileResponse {
    super_prompt: String,
    file_count: usize,
    source_chars: usize,
    format_label: String,
    estimate: token_counter::TokenEstimate,
}

#[derive(Serialize)]
struct GrepMatch {
    relative_path: String,
    line_number: usize,
    line_content: String,
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
fn scan_project(
    path: Option<String>,
    state: State<'_, AppState>,
) -> Result<ScanResponse, String> {
    // If a new path is supplied (e.g. from openFolder), update the project dir
    if let Some(p) = path {
        let new_dir = PathBuf::from(&p);
        if !new_dir.is_dir() {
            return Err(format!("Not a valid directory: {}", p));
        }
        let mut dir = state.project_dir.lock().map_err(|e| e.to_string())?;
        *dir = new_dir.clone();

        if let Ok(tx) = state.watcher_tx.lock() {
            let _ = tx.send(new_dir);
        }
    }

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
    skills_ids: Option<Vec<String>>,
    claude_md: Option<String>,
    state: State<'_, AppState>,
) -> Result<CompileResponse, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;

    let scan_result = scanner::scan_directory(&dir).map_err(|e| e.to_string())?;
    let repo_map = repo_map::generate_repo_map(&dir, &scan_result.files).map_err(|e| e.to_string())?;

    // Auto-load MEMORY.md from project if not provided by caller
    let claude_md_auto = if claude_md.is_some() {
        claude_md.clone()
    } else {
        let claude_md_path = dir.join(".hedgecoding").join("MEMORY.md");
        std::fs::read_to_string(&claude_md_path).ok()
    };

    let selected: Vec<_> = scan_result
        .files
        .iter()
        .filter(|f| selected_files.contains(&f.relative_path))
        .cloned()
        .collect();

    // Load Deep Analysis cache as file-level semantic intelligence.
    let cache_opt = analyzer::load_cache(&dir).ok().flatten();
    let da_file_count = cache_opt.as_ref().map(|c| c.summaries.len()).unwrap_or(0);
    let total_project_files = selected.len();
    let da_coverage = if da_file_count == 0 {
        "none".to_string()
    } else if da_file_count >= total_project_files.saturating_sub(2) {
        "full".to_string()
    } else {
        "partial".to_string()
    };
    let summaries_text = cache_opt.as_ref().map(|cache| {
        let mut entries: Vec<_> = cache.summaries.iter().collect();
        entries.sort_by_key(|(path, _)| path.to_string());
        entries.iter()
            .map(|(path, summary)| format!("{}: {}", path, summary))
            .collect::<Vec<_>>()
            .join("\n")
    });

    // ── Smart Compile: classify task + refine goal + select files ──
    let repo_map_text = render_repo_map(&repo_map);
    let mut task_size = String::new();
    let mut refined_goal = goal.clone();
    let mut task_instructions_opt: Option<String> = None;
    let mut relevant_skill_ids_opt: Option<Vec<String>> = None;

    // ─── Build skills meta for budget model (only name + description, not full bodies) ───
    // This is lightweight — just enough for the model to decide which skills are relevant.
    let skills_meta_text: Option<String> = skills_ids.as_ref().map(|ids| {
        ids.iter().filter_map(|id| {
            let path = dir.join(".hedgecoding").join("skills").join(format!("{}.md", id));
            let content = std::fs::read_to_string(&path).ok()?;
            let (meta, _) = parse_frontmatter(&content);
            let fallback_name = id.clone();
            let name = meta.get("name").unwrap_or(&fallback_name);
            let empty_desc = String::new();
            let desc = meta.get("description").unwrap_or(&empty_desc);
            Some(format!("- {}: {} — {}", id, name, desc))
        }).collect::<Vec<_>>().join("\n")
    }).filter(|s| !s.is_empty());

    let target_files = match analyzer::read_model_config(&dir) {
        Ok((model_id, base_url, api_key, anthropic_url)) => {
            eprintln!("  [HC] Classifying task and refining goal...");
            match analyzer::classify_and_refine(
                &goal,
                &repo_map_text,
                &model_id,
                &base_url,
                &api_key,
                &anthropic_url,
                skills_meta_text.as_deref(),
            ) {
                Ok(classification) => {
                    task_size = classification.size.clone();
                    refined_goal = classification.refined_goal.clone();
                    if !classification.task_instructions.trim().is_empty() {
                        task_instructions_opt = Some(classification.task_instructions.clone());
                    }
                    if !classification.relevant_skill_ids.is_empty() {
                        eprintln!("  [HC] Skills filtered by budget model: {} relevant",
                            classification.relevant_skill_ids.len());
                        relevant_skill_ids_opt = Some(classification.relevant_skill_ids.clone());
                    }
                    eprintln!("  [HC] Task: {} | {} target files | Refined: {}...",
                        classification.size,
                        classification.target_files.len(),
                        classification.refined_goal.chars().take(80).collect::<String>()
                    );

                    // Filter selected files to only those recommended by the classifier
                    let filtered: Vec<_> = selected.iter()
                        .filter(|f| classification.target_files.iter().any(|p| {
                            f.relative_path == *p || f.relative_path.replace('\\', "/") == *p
                        }))
                        .cloned()
                        .collect();

                    if filtered.is_empty() {
                        eprintln!("  [HC] Warning: no matches after filtering, falling back to all files");
                        selected.clone()
                    } else {
                        filtered
                    }
                }
                Err(e) => {
                    eprintln!("  [HC] Classification failed ({}), using all files", e);
                    selected.clone()
                }
            }
        }
        Err(_) => {
            eprintln!("  [HC] No model configured, using all files");
            selected.clone()
        }
    };

    // Git Intelligence: only for MEDIUM/LARGE tasks (skip for SMALL to keep prompt lean).
    let git_diff_text = if task_size == "SMALL" {
        None
    } else {
        git_intel::get_working_diff(dir.as_ref())
            .map(|intel| {
                eprintln!("  [HC] Git diff: {} files changed (+{} -{})", intel.files_changed, intel.insertions, intel.deletions);
                intel.summary
            })
    };

    // File Intelligence: only for MEDIUM/LARGE tasks.
    let effective_summaries = if task_size == "SMALL" {
        None
    } else {
        summaries_text.as_deref()
    };

    // ─── Resolve actual bodies of skills ───
    // Use budget model's filtered list if available; fall back to all user-selected IDs.
    let effective_skill_ids: Option<&Vec<String>> = relevant_skill_ids_opt
        .as_ref()
        .or(skills_ids.as_ref());

    let mut actual_skills_context = String::new();
    if let Some(ids) = effective_skill_ids {
        for id in ids {
            let path = dir.join(".hedgecoding").join("skills").join(format!("{}.md", id));
            if let Ok(content) = std::fs::read_to_string(&path) {
                let (meta, body) = parse_frontmatter(&content);
                let fallback_name = id.clone();
                let name = meta.get("name").unwrap_or(&fallback_name);
                let empty_desc = String::new();
                let desc = meta.get("description").unwrap_or(&empty_desc);
                actual_skills_context.push_str(&format!("### Skill: {}\n", name));
                if !desc.is_empty() {
                    actual_skills_context.push_str(&format!("{}\n", desc));
                }
                actual_skills_context.push_str(&format!("\n{}\n\n---\n\n", body.trim()));
            }
        }
    }
    let final_skills_context = if actual_skills_context.is_empty() {
        None
    } else {
        Some(actual_skills_context)
    };

    let options = compiler::CompileOptions {
        goal: &refined_goal,
        selected_files: &target_files,
        repo_map: &repo_map,
        checklist: checklist.as_deref(),
        skills_context: final_skills_context.as_deref(),
        claude_md: claude_md_auto.as_deref(),
        file_summaries: effective_summaries,
        git_diff: git_diff_text.as_deref(),
        task_instructions: task_instructions_opt.as_deref(),
    };

    let super_prompt = compiler::compile(&options).map_err(|e| e.to_string())?;
    let estimate = token_counter::estimate_cost(&super_prompt.content);
    let smart_was_selected = target_files.len() != selected.len();
    let total_before = selected.len();

    // -- Persistence: Save to .hedgecoding/tasks/ --
    let project_name = std::path::Path::new(&*dir)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "project".to_string());
        
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let tasks_dir = std::path::Path::new(&*dir).join(".hedgecoding").join("tasks");
    if !tasks_dir.exists() {
        let _ = std::fs::create_dir_all(&tasks_dir);
    }
    
    let file_name = format!("{}_{}.md", project_name, timestamp);
    let file_path = tasks_dir.join(&file_name);
    
    let frontmatter = format!(
        "---\ntask_size: {}\nda_coverage: {}\nda_files: {}\nchar_count: {}\ntoken_est: {}\n---\n\n",
        task_size,
        da_coverage,
        da_file_count,
        super_prompt.source_chars,
        (super_prompt.source_chars as f64 / 4.0).ceil() as usize
    );
    
    let full_content = format!("{}{}", frontmatter, super_prompt.content);
    let prompt_path_str = if let Ok(_) = std::fs::write(&file_path, full_content) {
        file_path.to_string_lossy().to_string()
    } else {
        "".to_string()
    };

    Ok(CompileResponse {
        super_prompt: super_prompt.content,
        prompt_path: prompt_path_str,
        file_count: super_prompt.file_count,
        source_chars: super_prompt.source_chars,
        estimate,
        smart_selected: smart_was_selected,
        total_files: total_before,
        task_size,
        refined_goal,
        deep_analysis_coverage: da_coverage,
        deep_analysis_files: da_file_count,
    })
}

#[derive(Serialize)]
struct PromptHistoryItemResponse {
    id: String,
    prompt_path: String,
    full_content: String,
    goal_snippet: String,
    instructions_snippet: String,
    task_size: String,
    da_coverage: String,
    da_files: usize,
    char_count: usize,
    token_est: usize,
    timestamp: u64,
}

fn extract_xml_tag(content: &str, tag: &str) -> String {
    let start_tag = format!("<{}>", tag);
    let end_tag = format!("</{}>", tag);
    
    if let Some(start_idx) = content.find(&start_tag) {
        let content_start = start_idx + start_tag.len();
        if let Some(end_idx) = content[content_start..].find(&end_tag) {
            return content[content_start..content_start + end_idx].trim().to_string();
        }
    }
    "".to_string()
}

#[tauri::command]
fn load_prompt_history(dir: String) -> Result<Vec<PromptHistoryItemResponse>, String> {
    let tasks_dir = std::path::Path::new(&dir).join(".hedgecoding").join("tasks");
    if !tasks_dir.exists() {
        return Ok(Vec::new());
    }

    let mut history = Vec::new();
    if let Ok(entries) = std::fs::read_dir(tasks_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    let file_stem = path.file_stem().unwrap_or_default().to_string_lossy();
                    let timestamp_str = file_stem.split('_').last().unwrap_or("0");
                    let timestamp = timestamp_str.parse::<u64>().unwrap_or(0);

                    let mut task_size = "MEDIUM".to_string();
                    let mut da_coverage = "none".to_string();
                    let mut da_files = 0;
                    let mut char_count = content.len();
                    let mut token_est = char_count / 4;
                    let mut body_start = 0;
                    
                    if content.starts_with("---\n") {
                        if let Some(end_idx) = content[4..].find("\n---\n") {
                            let fm = &content[4..4 + end_idx];
                            body_start = 4 + end_idx + 5;
                            for line in fm.lines() {
                                if let Some((k, v)) = line.split_once(':') {
                                    let key = k.trim();
                                    let val = v.trim();
                                    match key {
                                        "task_size" => task_size = val.to_string(),
                                        "da_coverage" => da_coverage = val.to_string(),
                                        "da_files" => da_files = val.parse().unwrap_or(0),
                                        "char_count" => char_count = val.parse().unwrap_or(char_count),
                                        "token_est" => token_est = val.parse().unwrap_or(token_est),
                                        _ => {}
                                    }
                                }
                            }
                        }
                    }
                    
                    let body = &content[body_start..];
                    let goal_snippet = extract_xml_tag(body, "user_goal");
                    let instructions_snippet = extract_xml_tag(body, "execution_instructions");
                    let id = format!("{}_{}", timestamp, path.file_name().unwrap_or_default().to_string_lossy());
                    
                    history.push(PromptHistoryItemResponse {
                        id,
                        prompt_path: path.to_string_lossy().to_string(),
                        full_content: body.to_string(),
                        goal_snippet,
                        instructions_snippet,
                        task_size,
                        da_coverage,
                        da_files,
                        char_count,
                        token_est,
                        timestamp,
                    });
                }
            }
        }
    }
    history.sort_by_key(|h| h.timestamp);
    Ok(history)
}

#[tauri::command]
fn get_git_status(state: State<'_, AppState>) -> Result<Option<GitStatusResponse>, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    Ok(git_intel::get_git_status_summary(dir.as_ref()).map(|(fc, ins, del)| {
        GitStatusResponse {
            files_changed: fc,
            insertions: ins,
            deletions: del,
        }
    }))
}

#[tauri::command]
fn get_model(_state: State<'_, AppState>) -> Result<ModelInfo, String> {
    let models_path = dirs::home_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())?
        .join(".HedgeCoding")
        .join("models.json");

    let content = std::fs::read_to_string(&models_path)
        .map_err(|_| "models.json not found at ~/.HedgeCoding/models.json".to_string())?;

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

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}


#[tauri::command]
fn window_maximize(window: tauri::Window) {
    let is_max = window.is_maximized().unwrap_or(false);
    if is_max { let _ = window.unmaximize(); } else { let _ = window.maximize(); }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

/// Open a native folder picker dialog.
/// Returns the selected folder path as a string, or an error if cancelled.
#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<String, String> {
    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder();

    match folder {
        Some(path) => Ok(path.to_string()),
        None => Err("cancelled".to_string()),
    }
}

// ─── Deep Analysis Commands ───────────────────────────

#[derive(Serialize)]
struct AnalysisProgress {
    file: String,
    summary: String,
    index: usize,
    total: usize,
    error: Option<String>,
    /// Tokens consumed by this file analysis (0 before result)
    input_tokens: u32,
    output_tokens: u32,
}

/// Check if the cheap model is configured. Returns model info or error.
#[tauri::command]
fn check_model_config(state: State<'_, AppState>) -> Result<String, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    analyzer::read_model_config(&dir).map(|(model_id, base_url, _, _)| {
        format!("{} @ {}", model_id, base_url)
    })
}

/// Cancel a running deep analysis loop
#[tauri::command]
fn cancel_deep_analysis(state: State<'_, AppState>) {
    state.analysis_cancelled.store(true, std::sync::atomic::Ordering::Relaxed);
}

/// Run deep analysis: summarize each file one by one, emitting progress events.
/// Each HTTP call runs in a dedicated blocking thread via spawn_blocking to keep
/// the tokio runtime and WebView2 UI thread responsive.
#[tauri::command]
async fn deep_analyze(
    files: Vec<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?.clone();

    // Validate model config before starting (fast disk read, OK on async thread)
    let (model_id, base_url, api_key, anthropic_url) = analyzer::read_model_config(&dir)?;

    // Rest reset cancel token before starting a new run
    state.analysis_cancelled.store(false, std::sync::atomic::Ordering::Relaxed);

    let total = files.len();
    let mut summaries: HashMap<String, String> = HashMap::new();

    for (index, rel_path) in files.iter().enumerate() {
        if state.analysis_cancelled.load(std::sync::atomic::Ordering::Relaxed) {
            break;
        }

        let file_path = dir.join(rel_path.replace('/', std::path::MAIN_SEPARATOR_STR));

        // Read file content (fast, OK on async thread)
        let content = match std::fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(e) => {
                let progress = AnalysisProgress {
                    file: rel_path.clone(),
                    summary: String::new(),
                    index,
                    total,
                    error: Some(format!("Cannot read file: {}", e)),
                    input_tokens: 0,
                    output_tokens: 0,
                };
                let _ = app.emit("analysis-progress", &progress);
                continue;
            }
        };

        // ─── First Emit: Tell Frontend which file is being analyzed ───
        let progress_start = AnalysisProgress {
            file: rel_path.clone(),
            summary: "__ANALYZING__".to_string(),
            index,
            total,
            error: None,
            input_tokens: 0,
            output_tokens: 0,
        };
        let _ = app.emit("analysis-progress", &progress_start);

        let rp = rel_path.clone();
        let mi = model_id.clone();
        let bu = base_url.clone();
        let ak = api_key.clone();
        let au = anthropic_url.clone();
        let result: Result<(String, analyzer::TokenUsage), String> = tauri::async_runtime::spawn_blocking(move || {
            analyzer::summarize_file(&rp, &content, &mi, &bu, &ak, &au)
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?;

        match result {
            Ok((summary, usage)) => {
                summaries.insert(rel_path.clone(), summary.clone());
                let progress = AnalysisProgress {
                    file: rel_path.clone(),
                    summary,
                    index,
                    total,
                    error: None,
                    input_tokens: usage.input_tokens,
                    output_tokens: usage.output_tokens,
                };
                let _ = app.emit("analysis-progress", &progress);
            }
            Err(e) => {
                let progress = AnalysisProgress {
                    file: rel_path.clone(),
                    summary: String::new(),
                    index,
                    total,
                    error: Some(e),
                    input_tokens: 0,
                    output_tokens: 0,
                };
                let _ = app.emit("analysis-progress", &progress);
            }
        }
    }

    Ok(summaries)
}

// ─── Code Review Commands ────────────────────────────────

#[derive(Serialize)]
struct ReviewCompileResponse {
    super_prompt: String,
    files_in_diff: usize,
    diff_chars: usize,
    estimate: token_counter::TokenEstimate,
}

/// Compile a Code Review Super Prompt from a git diff.
/// Optionally enriches context with existing deep analysis summaries as scout report.
#[tauri::command]
fn compile_review(
    diff_text: String,
    state: State<'_, AppState>,
) -> Result<ReviewCompileResponse, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;

    // Scan + generate repo map for full codebase context
    let scan_result = scanner::scan_directory(&dir).map_err(|e| e.to_string())?;
    let repo_map = repo_map::generate_repo_map(&dir, &scan_result.files).map_err(|e| e.to_string())?;

    // Load existing analysis cache as scout report (if available)
    let cache_opt = analyzer::load_cache(&dir).ok().flatten();
    let scout_text = cache_opt.as_ref().map(|cache| {
        cache.summaries.iter()
            .map(|(path, summary)| format!("{}: {}", path, summary))
            .collect::<Vec<_>>()
            .join("\n")
    });
    let scout_ref = scout_text.as_deref();

    // Load project-level REVIEW.md rules
    let review_rules_path = dir.join(".hedgecoding").join("REVIEW.md");
    let review_rules = std::fs::read_to_string(&review_rules_path).ok();
    let rules_ref = review_rules.as_deref();

    let options = ReviewCompileOptions {
        diff_text: &diff_text,
        repo_map: &repo_map,
        scout_report: scout_ref,
        review_rules: rules_ref,
    };

    let super_prompt = compiler::compile_review(&options).map_err(|e| e.to_string())?;
    let estimate = token_counter::estimate_cost(&super_prompt.content);

    Ok(ReviewCompileResponse {
        files_in_diff: super_prompt.file_count,
        diff_chars: super_prompt.source_chars,
        super_prompt: super_prompt.content,
        estimate,
    })
}

/// Load project-level review rules from .hedgecoding/REVIEW.md.
/// Returns null if the file does not exist.
#[tauri::command]
fn load_review_rules(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let rules_path = dir.join(".hedgecoding").join("REVIEW.md");
    match std::fs::read_to_string(&rules_path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read REVIEW.md: {}", e)),
    }
}

/// Save review rules to .hedgecoding/REVIEW.md
#[tauri::command]
fn save_review_rules(
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let hc_dir = dir.join(".hedgecoding");
    std::fs::create_dir_all(&hc_dir).map_err(|e| format!("Failed to create .hedgecoding dir: {}", e))?;
    let rules_path = hc_dir.join("REVIEW.md");
    std::fs::write(&rules_path, content).map_err(|e| format!("Failed to write REVIEW.md: {}", e))
}

/// Save the analysis cache to {project_dir}/.hedgecoding/analysis_cache.json
#[tauri::command]
fn save_analysis_cache(
    cache_json: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?.clone();
    let cache: analyzer::AnalysisCache = serde_json::from_str(&cache_json)
        .map_err(|e| format!("Invalid cache JSON: {}", e))?;
    analyzer::save_cache(&dir, &cache)
}

/// Load the analysis cache from {project_dir}/.hedgecoding/analysis_cache.json
/// Returns null (None) if no cache exists.
#[tauri::command]
fn load_analysis_cache(state: State<'_, AppState>) -> Result<Option<analyzer::AnalysisCache>, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?.clone();
    analyzer::load_cache(&dir)
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

// ─── MEMORY.md Project Memory ──────────────────────────────────────────────

/// Load project-level MEMORY.md from .hedgecoding/MEMORY.md.
/// Returns null if the file does not exist.
#[tauri::command]
fn load_claude_md(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let path = dir.join(".hedgecoding").join("MEMORY.md");
    match std::fs::read_to_string(&path) {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read MEMORY.md: {}", e)),
    }
}

/// Save MEMORY.md to .hedgecoding/MEMORY.md.
#[tauri::command]
fn save_claude_md(
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let hc_dir = dir.join(".hedgecoding");
    std::fs::create_dir_all(&hc_dir)
        .map_err(|e| format!("Failed to create .hedgecoding dir: {}", e))?;
    let path = hc_dir.join("MEMORY.md");
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write MEMORY.md: {}", e))
}

// ─── Grep Search ──────────────────────────────────────────────────────────────

/// Search for a pattern across all project files (read-only).
/// Returns up to 200 matches with file path, line number, and content.
#[tauri::command]
fn grep_project(
    pattern: String,
    state: State<'_, AppState>,
) -> Result<Vec<GrepMatch>, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let scan_result = scanner::scan_directory(&dir).map_err(|e| e.to_string())?;

    let pattern_lower = pattern.to_lowercase();
    let mut matches: Vec<GrepMatch> = vec![];
    const MAX_MATCHES: usize = 200;

    'outer: for file_entry in &scan_result.files {
        let file_path = dir.join(file_entry.relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));
        let content = match std::fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for (line_idx, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&pattern_lower) {
                matches.push(GrepMatch {
                    relative_path: file_entry.relative_path.clone(),
                    line_number: line_idx + 1,
                    line_content: line.trim().to_string(),
                });
                if matches.len() >= MAX_MATCHES {
                    break 'outer;
                }
            }
        }
    }

    Ok(matches)
}

// ─── Super Docs Compiler ──────────────────────────────────────────────────────

/// Compile a Super Docs prompt — semantic documentation generation powered by
/// full source code reading (not just syntax parsing like JSDoc/TypeDoc).
#[tauri::command]
fn compile_docs(
    goal: String,
    selected_files: Vec<String>,
    format: String,
    state: State<'_, AppState>,
) -> Result<DocsCompileResponse, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;

    let scan_result = scanner::scan_directory(&dir).map_err(|e| e.to_string())?;
    let repo_map = repo_map::generate_repo_map(&dir, &scan_result.files).map_err(|e| e.to_string())?;

    // Auto-load project memory
    let memory_path = dir.join(".hedgecoding").join("MEMORY.md");
    let project_memory = std::fs::read_to_string(&memory_path).ok();

    // Use existing Deep Analysis cache as file-level semantic summaries.
    // These were already generated by cheap models — reuse that intelligence
    // instead of asking the doc model to re-derive understanding from scratch.
    let cache_opt = analyzer::load_cache(&dir).ok().flatten();
    let analysis_summaries = cache_opt.as_ref().map(|cache| {
        cache.summaries.iter()
            .map(|(path, summary)| format!("{}:\n  {}", path, summary))
            .collect::<Vec<_>>()
            .join("\n")
    });

    // Resolve selected files (or all files if none selected)
    let selected: Vec<_> = if selected_files.is_empty() {
        scan_result.files.clone()
    } else {
        scan_result.files.iter()
            .filter(|f| selected_files.contains(&f.relative_path))
            .cloned()
            .collect()
    };

    let doc_format = DocFormat::from_str(&format);
    let format_label = doc_format.label().to_string();

    let options = DocCompileOptions {
        goal: &goal,
        repo_map: &repo_map,
        selected_files: &selected,
        format: doc_format,
        project_memory: project_memory.as_deref(),
        file_summaries: analysis_summaries.as_deref(),
    };

    let super_prompt = compiler::compile_docs(&options).map_err(|e| e.to_string())?;
    let estimate = token_counter::estimate_cost(&super_prompt.content);

    Ok(DocsCompileResponse {
        super_prompt: super_prompt.content,
        file_count: super_prompt.file_count,
        source_chars: super_prompt.source_chars,
        format_label,
        estimate,
    })
}

// ─── Skills System ──────────────────────────────────────────

#[derive(Serialize, Clone)]
struct SkillMeta {
    /// Filename slug, e.g. "rust-safety"
    id: String,
    /// Human-readable name from frontmatter `name:` or filename
    name: String,
    /// Short description from frontmatter `description:`
    description: String,
    /// Category tag from frontmatter `category:` (default: "General")
    category: String,
    /// Inject-by-default flag from frontmatter `auto_inject: true`
    auto_inject: bool,
    /// Character count of the skill body
    char_count: usize,
    /// When to apply this skill (from frontmatter `when_to_use:`)
    when_to_use: Option<String>,
}

/// Parse a simple YAML-like frontmatter block delimited by `---`.
/// Returns (metadata_map, body) or None if no frontmatter.
fn parse_frontmatter(content: &str) -> (std::collections::HashMap<String, String>, String) {
    let mut meta = std::collections::HashMap::new();
    let body;

    let trimmed = content.trim_start();
    if let Some(rest) = trimmed.strip_prefix("---") {
        // Find closing ---
        if let Some(end) = rest.find("\n---") {
            let fm_block = &rest[..end];
            body = rest[end + 4..].trim_start().to_string();

            for line in fm_block.lines() {
                if let Some((k, v)) = line.split_once(':') {
                    meta.insert(k.trim().to_lowercase(), v.trim().to_string());
                }
            }
        } else {
            body = content.to_string();
        }
    } else {
        body = content.to_string();
    }

    (meta, body)
}

/// List all skills in .hedgecoding/skills/
/// If the directory does not exist, returns an empty list (not an error).
#[tauri::command]
fn open_skills_dir(state: State<'_, AppState>) -> Result<(), String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let mut target_dir = dir.join(".hedgecoding").join("skills");
    if !target_dir.exists() {
        if let Err(_) = std::fs::create_dir_all(&target_dir) {
            // Fallback to global if local fails (e.g. Access Denied)
            if let Some(home) = dirs::home_dir() {
                target_dir = home.join(".HedgeCoding").join("skills");
                let _ = std::fs::create_dir_all(&target_dir);
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer").arg(&target_dir).spawn();

    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(&target_dir).spawn();

    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(&target_dir).spawn();

    Ok(())
}

#[tauri::command]
fn list_skills(state: State<'_, AppState>) -> Result<Vec<SkillMeta>, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;

    let mut skills = vec![];
    let mut seen_ids = std::collections::HashSet::new();
    let mut dirs_to_scan = vec![];

    // 1. Gather Global Skills (~/.HedgeCoding/skills/)
    if let Some(home) = dirs::home_dir() {
        let global_skills_dir = home.join(".HedgeCoding").join("skills");
        // Seed default skills globally
        if !global_skills_dir.exists() {
            if let Ok(_) = std::fs::create_dir_all(&global_skills_dir) {
                let default_skills = vec![
                    (
                        "systematic-debugging.md",
                        r#"---
name: Systematic Debugging
description: Enforces a rigorous 4-step root-cause analysis process before fixing any bug.
category: Architecture
---

# Systematic Debugging Methodology

When asked to fix a bug or investigate an issue, you MUST follow this 4-step framework. Do NOT jump straight to writing a fix or guessing the solution.

## Step 1: Reproduce & Pinpoint
1. Identify the exact line of code, API call, or UI component where the error originates.
2. Formulate a clear mental model of how the data flows into this failure point.

## Step 2: Root Cause Analysis (RCA)
1. Ask "Why did this happen?" repeatedly until you reach the foundational logic error.
2. Differentiate between the *symptom* (what the user sees) and the *disease* (the actual flawed assumption in the codebase).

## Step 3: Propose Solution
1. Explain the fix concisely.
2. Outline any potential side effects this fix might have on other parts of the system.

## Step 4: Red-Green-Refactor
1. Implement the minimal fix required.
2. If tests exist, explain how they validate the fix.
"#
                    ),
                    (
                        "test-driven-development.md",
                        r#"---
name: Test-Driven Development
description: Forces the AI to write failing tests before implementing business logic.
category: Quality
---

# Test-Driven Development (TDD) Protocol

Whenever you are asked to implement a new feature, a new function, or a complex logic block, you MUST follow the TDD protocol.

1. **RED**: Write the test FIRST. The test must accurately reflect the requirements and fail. Explain your test design.
2. **GREEN**: Write the minimal implementation code to make the test pass. Do not over-engineer.
3. **REFACTOR**: Clean up the code. Ensure there is no duplication, names are clear, and performance is optimal, without breaking the test.

Never write the implementation code before the test.
"#
                    )
                ];

                for (filename, content) in default_skills {
                    let _ = std::fs::write(global_skills_dir.join(filename), content);
                }
            }
        }
        dirs_to_scan.push(global_skills_dir);
    }

    // 2. Gather Local Skills ([project]/.hedgecoding/skills/)
    dirs_to_scan.push(dir.join(".hedgecoding").join("skills"));

    for s_dir in dirs_to_scan {
        if !s_dir.exists() { continue; }
        if let Ok(entries) = std::fs::read_dir(&s_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("md") {
                    continue;
                }

                let filename = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                if seen_ids.contains(&filename) { 
                    skills.retain(|s: &SkillMeta| s.id != filename); // local overrides global
                }
                seen_ids.insert(filename.clone());

                let content = std::fs::read_to_string(&path)
                    .unwrap_or_default();
                let (meta, body) = parse_frontmatter(&content);

                skills.push(SkillMeta {
                    id: filename.clone(),
                    name: meta.get("name").cloned().unwrap_or_else(|| {
                        filename.replace('-', " ")
                            .split_whitespace()
                            .map(|w| {
                                let mut c = w.chars();
                                match c.next() {
                                    None => String::new(),
                                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                                }
                            })
                            .collect::<Vec<_>>()
                            .join(" ")
                    }),
                    description: meta.get("description").cloned().unwrap_or_default(),
                    category: meta.get("category").cloned().unwrap_or_else(|| "General".to_string()),
                    auto_inject: meta.get("auto_inject").map(|v| v == "true").unwrap_or(false),
                    char_count: body.len(),
                    when_to_use: meta.get("when_to_use").cloned()
                        .or_else(|| meta.get("when-to-use").cloned()),
                });
            }
        }
    }

    skills.sort_by(|a, b| a.category.cmp(&b.category).then(a.name.cmp(&b.name)));
    Ok(skills)
}

/// Load the full content of a single skill by ID (filename without .md).
#[tauri::command]
fn load_skill(skill_id: String, state: State<'_, AppState>) -> Result<String, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let local_path = dir.join(".hedgecoding").join("skills").join(format!("{}.md", skill_id));
    let mut target_path = local_path.clone();

    if !target_path.exists() {
        if let Some(home) = dirs::home_dir() {
            let global_path = home.join(".HedgeCoding").join("skills").join(format!("{}.md", skill_id));
            if global_path.exists() {
                target_path = global_path;
            }
        }
    }

    if !target_path.exists() {
        return Err(format!("Skill '{}' not found in local or global skills directory", skill_id));
    }

    let content = std::fs::read_to_string(&target_path)
        .map_err(|e| format!("Failed to read skill: {}", e))?;

    // Return body only (strip frontmatter)
    let (_, body) = parse_frontmatter(&content);
    Ok(body)
}

/// Save a skill file to .hedgecoding/skills/{id}.md.
/// Creates the directory if needed.
#[tauri::command]
fn save_skill(
    skill_id: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let skills_dir = dir.join(".hedgecoding").join("skills");
    std::fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills dir: {}", e))?;

    let skill_path = skills_dir.join(format!("{}.md", skill_id));
    std::fs::write(&skill_path, content)
        .map_err(|e| format!("Failed to write skill: {}", e))
}

/// Create the default example skill if no skills exist yet.
/// Returns the list of skills after creation.
#[tauri::command]
fn create_example_skill(state: State<'_, AppState>) -> Result<Vec<SkillMeta>, String> {
    let dir = state.project_dir.lock().map_err(|e| e.to_string())?;
    let skills_dir = dir.join(".hedgecoding").join("skills");
    std::fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills dir: {}", e))?;

    let example_path = skills_dir.join("example-skill.md");
    if !example_path.exists() {
        let example_content = "\
---
name: Example Skill
description: A starter skill template. Edit me!
category: General
auto_inject: false
when_to_use: Apply this skill when working on TypeScript files to enforce consistent code style.
---

# Example Skill

This is a reusable coding guideline that will be injected into your Super Prompt.

## Rules

- Always add error handling
- Prefer explicit types over `any`
- Add JSDoc comments to public APIs
- Use `const` by default
";
        std::fs::write(&example_path, example_content)
            .map_err(|e| format!("Failed to write example skill: {}", e))?;
    }

    // Return updated list (re-use list_skills logic)
    drop(dir); // release lock before calling list_skills
    Ok(vec![]) // caller should re-fetch via list_skills
}

// ─── Tauri App Builder ───────────────────────────────

pub fn start_ui(project_dir: PathBuf) -> anyhow::Result<()> {
    let (tx, rx) = std::sync::mpsc::channel();
    // Kickstart watcher with initial directory (as absolute path)
    let abs_dir = std::fs::canonicalize(&project_dir).unwrap_or_else(|_| project_dir.clone());
    let _ = tx.send(abs_dir);

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            project_dir: Mutex::new(project_dir),
            analysis_cancelled: std::sync::atomic::AtomicBool::new(false),
            watcher_tx: Mutex::new(tx),
        })
        .invoke_handler(tauri::generate_handler![
            scan_project,
            compile_prompt,
            compile_review,
            load_review_rules,
            save_review_rules,
            load_claude_md,
            save_claude_md,
            grep_project,
            compile_docs,
            list_skills,
            load_skill,
            save_skill,
            open_skills_dir,
            create_example_skill,
            load_prompt_history,
            get_model,
            pick_folder,
            check_model_config,
            cancel_deep_analysis,
            deep_analyze,
            save_analysis_cache,
            load_analysis_cache,
            window_minimize,
            window_maximize,
            window_close,
            get_git_status,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Start the filesystem watcher manager in background
            watcher::start_watcher(app.handle().clone(), rx);

            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|e| anyhow::anyhow!("Error while running tauri application: {}", e))?;

    Ok(())
}

