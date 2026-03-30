// Budget Coder — Repo Map generator
// Produces a compact text representation of project structure + symbols
// Inspired by Aider's repo map approach

use crate::parser::{extract_symbols, Symbol, SymbolKind};
use crate::scanner::FileEntry;
use anyhow::Result;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Symbols extracted for a single file
#[derive(Debug, Serialize)]
pub struct FileSymbols {
    pub relative_path: String,
    pub symbols: Vec<Symbol>,
    pub line_count: usize,
}

/// Complete repo map for a project
#[derive(Debug, Serialize)]
pub struct RepoMap {
    pub files: Vec<FileSymbols>,
    pub total_symbols: usize,
}

/// Generate a repo map from scanned files
pub fn generate_repo_map(root: &Path, files: &[FileEntry]) -> Result<RepoMap> {
    let mut file_symbols_list = Vec::new();
    let mut total_symbols = 0;

    for entry in files {
        // Read file content
        let content = match fs::read_to_string(&entry.path) {
            Ok(c) => c,
            Err(_) => continue, // skip files that can't be read as UTF-8
        };

        let line_count = content.lines().count();

        // Extract symbols using tree-sitter
        let symbols = extract_symbols(&entry.path, &content).unwrap_or_default();
        total_symbols += symbols.len();

        file_symbols_list.push(FileSymbols {
            relative_path: entry.relative_path.clone(),
            symbols,
            line_count,
        });
    }

    // Sort: files with more symbols first (more "important" files)
    file_symbols_list.sort_by(|a, b| b.symbols.len().cmp(&a.symbols.len()));

    Ok(RepoMap {
        files: file_symbols_list,
        total_symbols,
    })
}

/// Render the repo map as a compact text string
pub fn render_repo_map(map: &RepoMap) -> String {
    let mut output = String::new();

    for file_syms in &map.files {
        // File header
        output.push_str(&file_syms.relative_path);
        output.push_str(&format!(" ({} lines)\n", file_syms.line_count));

        // Symbols
        if file_syms.symbols.is_empty() {
            output.push_str("  (no symbols extracted)\n");
        } else {
            for sym in &file_syms.symbols {
                output.push_str(&format!("  ├─ {} {}\n", sym.kind, sym.name));
            }
        }
        output.push('\n');
    }

    output
}

/// Render a compact version of the repo map (just file paths + symbol counts)
pub fn render_repo_map_compact(map: &RepoMap) -> String {
    let mut output = String::new();

    // Group by directory
    let mut dir_files: HashMap<String, Vec<&FileSymbols>> = HashMap::new();
    for file_syms in &map.files {
        let dir = Path::new(&file_syms.relative_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string());
        dir_files.entry(dir).or_default().push(file_syms);
    }

    let mut dirs: Vec<_> = dir_files.keys().cloned().collect();
    dirs.sort();

    for dir in &dirs {
        output.push_str(&format!("{}/ \n", dir));
        if let Some(files) = dir_files.get(dir) {
            for file_syms in files {
                let filename = Path::new(&file_syms.relative_path)
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_default();
                let sym_count = file_syms.symbols.len();
                let sym_summary: Vec<String> = file_syms
                    .symbols
                    .iter()
                    .take(5) // show at most 5 symbols per file in compact mode
                    .map(|s| s.name.clone())
                    .collect();

                if sym_summary.is_empty() {
                    output.push_str(&format!("  {} ({} lines)\n", filename, file_syms.line_count));
                } else {
                    let extra = if sym_count > 5 {
                        format!(", +{} more", sym_count - 5)
                    } else {
                        String::new()
                    };
                    output.push_str(&format!(
                        "  {} [{}{}]\n",
                        filename,
                        sym_summary.join(", "),
                        extra
                    ));
                }
            }
        }
        output.push('\n');
    }

    output
}

/// Print the repo map with colors
pub fn print_repo_map(map: &RepoMap) {
    use colored::Colorize;

    println!(
        "\n{}",
        "━━━ Repo Map ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            .bright_cyan()
            .bold()
    );
    println!(
        "  {} {}",
        "Files:".dimmed(),
        map.files.len().to_string().white()
    );
    println!(
        "  {} {}\n",
        "Symbols:".dimmed(),
        map.total_symbols.to_string().green().bold()
    );

    for file_syms in &map.files {
        println!(
            "{}  {}",
            file_syms.relative_path.bright_white().bold(),
            format!("({} lines)", file_syms.line_count).dimmed()
        );

        for sym in &file_syms.symbols {
            let kind_str = format!("{}", sym.kind);
            let kind_colored = match sym.kind {
                SymbolKind::Function => kind_str.bright_blue(),
                SymbolKind::Class | SymbolKind::Struct => kind_str.bright_yellow(),
                SymbolKind::Interface | SymbolKind::TypeAlias => kind_str.bright_magenta(),
                SymbolKind::Enum => kind_str.bright_green(),
                SymbolKind::Trait => kind_str.bright_cyan(),
                SymbolKind::Impl => kind_str.cyan(),
                SymbolKind::Constant => kind_str.bright_red(),
                SymbolKind::Export => kind_str.white(),
                SymbolKind::Module => kind_str.yellow(),
            };
            println!("  ├─ {} {}", kind_colored, sym.name.white());
        }
        println!();
    }
}
