// Budget Coder — Directory scanner using the `ignore` crate
// Same engine as ripgrep — respects .gitignore automatically

use crate::config::{MAX_DEPTH, MAX_FILES, MAX_FILE_SIZE};
use anyhow::Result;
use ignore::WalkBuilder;
use serde::Serialize;
use std::path::{Path, PathBuf};

/// Metadata about a single scanned file
#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    /// Absolute path to the file
    pub path: PathBuf,
    /// Path relative to the scanned root directory
    pub relative_path: String,
    /// File size in bytes
    pub size: u64,
    /// File extension (lowercase)
    pub extension: String,
}

/// Result of scanning a directory
#[derive(Debug, Serialize)]
pub struct ScanResult {
    /// Root directory that was scanned
    pub root: PathBuf,
    /// All text files found
    pub files: Vec<FileEntry>,
    /// Files that were skipped (too large, binary, etc.)
    pub skipped: Vec<String>,
    /// Total files scanned
    pub total_scanned: usize,
}

/// Known text file extensions
fn is_text_extension(ext: &str) -> bool {
    matches!(
        ext,
        "rs" | "js" | "jsx" | "ts" | "tsx" | "py" | "go" | "java"
            | "c" | "cpp" | "h" | "hpp" | "cs"
            | "rb" | "php" | "swift" | "kt" | "kts"
            | "scala" | "clj" | "ex" | "exs"
            | "html" | "htm" | "css" | "scss" | "less" | "sass"
            | "json" | "yaml" | "yml" | "toml" | "xml"
            | "md" | "txt" | "rst" | "adoc"
            | "sh" | "bash" | "zsh" | "fish" | "ps1" | "bat" | "cmd"
            | "sql" | "graphql" | "gql" | "proto"
            | "dockerfile" | "makefile" | "cmake"
            | "tf" | "hcl" | "nix"
            | "vue" | "svelte" | "astro"
            | "lua" | "r" | "m" | "jl"
            | "zig" | "v" | "nim" | "cr" | "dart" | "elm"
            | "env" | "ini" | "cfg" | "conf"
            | "lock" // included for structure, usually filtered by name
    )
}

/// Scan a directory and return all text source files
pub fn scan_directory(root: &Path) -> Result<ScanResult> {
    let root = root.canonicalize()?;
    let mut files = Vec::new();
    let mut skipped = Vec::new();
    let mut total_scanned = 0;

    let walker = WalkBuilder::new(&root)
        .max_depth(Some(MAX_DEPTH))
        .hidden(true) // skip hidden files/dirs
        .git_ignore(true) // respect .gitignore
        .git_global(true)
        .git_exclude(true)
        .build();

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        // Skip directories
        if entry.file_type().map_or(true, |ft| !ft.is_file()) {
            continue;
        }

        total_scanned += 1;

        // Safety: cap at MAX_FILES
        if files.len() >= MAX_FILES {
            skipped.push(format!(
                "Reached file limit ({}), stopping scan",
                MAX_FILES
            ));
            break;
        }

        let path = entry.path().to_path_buf();
        let relative = path
            .strip_prefix(&root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        // Get file extension
        let extension = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        // Check for known filenames without extensions
        let filename = path
            .file_name()
            .map(|f| f.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let is_known_textfile = matches!(
            filename.as_str(),
            "dockerfile" | "makefile" | "cmakelists.txt" | "rakefile" | "gemfile" | "procfile"
        );

        // Filter: only text files
        if !is_text_extension(&extension) && !is_known_textfile {
            continue;
        }

        // Get file size
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

        // Skip files that are too large
        if size > MAX_FILE_SIZE {
            skipped.push(format!("{} (too large: {} KB)", relative, size / 1024));
            continue;
        }

        files.push(FileEntry {
            path,
            relative_path: relative,
            size,
            extension,
        });
    }

    // Sort files by path for deterministic output
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    Ok(ScanResult {
        root,
        files,
        skipped,
        total_scanned,
    })
}

/// Print a summary of the scan result
pub fn print_scan_summary(result: &ScanResult) {
    use colored::Colorize;

    println!(
        "\n{}",
        "━━━ Scan Result ━━━━━━━━━━━━━━━━━━━━━━━━━━"
            .bright_cyan()
            .bold()
    );
    println!(
        "  {} {}",
        "Root:".dimmed(),
        result.root.display().to_string().white()
    );
    println!(
        "  {} {}",
        "Files found:".dimmed(),
        result.files.len().to_string().green().bold()
    );
    println!(
        "  {} {}",
        "Total scanned:".dimmed(),
        result.total_scanned.to_string().white()
    );

    if !result.skipped.is_empty() {
        println!(
            "  {} {}",
            "Skipped:".dimmed(),
            result.skipped.len().to_string().yellow()
        );
        for s in &result.skipped {
            println!("    {} {}", "⚠".yellow(), s.dimmed());
        }
    }

    // Group by extension
    let mut ext_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for f in &result.files {
        *ext_counts
            .entry(if f.extension.is_empty() {
                "(no ext)".to_string()
            } else {
                format!(".{}", f.extension)
            })
            .or_default() += 1;
    }
    let mut ext_list: Vec<_> = ext_counts.into_iter().collect();
    ext_list.sort_by(|a, b| b.1.cmp(&a.1));

    println!("  {} ", "File types:".dimmed());
    for (ext, count) in ext_list.iter().take(10) {
        println!("    {} {}", format!("{:>4}", count).cyan(), ext.white());
    }
    if ext_list.len() > 10 {
        println!(
            "    {}",
            format!("  ... and {} more types", ext_list.len() - 10).dimmed()
        );
    }
    println!();
}
