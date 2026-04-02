// Hedge Coding — A Prompt Compiler for AI Coding Assistants
// "Let cheap models read your code, let expensive models write code."

mod analyzer;
mod compiler;
mod config;
mod git_intel;
mod parser;
mod repo_map;
mod scanner;
mod watcher;

mod server;
mod token_counter;

use anyhow::Result;
use clap::Parser;
use colored::Colorize;
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "hedge-coding",
    about = "A Prompt Compiler — hedge your AI coding costs by scanning with cheap models and writing with expensive ones",
    long_about = "Hedge Coding scans your local codebase using Tree-sitter, generates a compact Repo Map,\n\
                  and compiles a structured Super Prompt (XML) containing only the relevant files.\n\n\
                  Use a cheap/fast model to analyze → then paste the Super Prompt into an expensive model.",
    version
)]
struct Cli {
    /// Path to the project directory to scan
    #[arg(short, long, default_value = ".")]
    dir: PathBuf,

    /// Your coding goal / instruction
    #[arg(short, long)]
    goal: Option<String>,

    /// Output file for the Super Prompt (default: stdout / clipboard)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Show only the repo map, don't compile a Super Prompt
    #[arg(long)]
    map_only: bool,

    /// Show scan results only
    #[arg(long)]
    scan_only: bool,

    /// Include specific files (glob patterns, comma-separated)
    #[arg(short, long, value_delimiter = ',')]
    include: Option<Vec<String>>,

    /// Maximum number of files to include in the Super Prompt
    #[arg(long, default_value = "50")]
    max_files: usize,

    /// Launch the Web UI in browser
    #[arg(long)]
    ui: bool,

    /// Port for the Web UI server
    #[arg(long, default_value = "3141")]
    port: u16,
}

fn main() -> Result<()> {
    let mut args: Vec<String> = std::env::args().collect();
    
    // Auto-detect Desktop Mode:
    // If double-clicked or run without task arguments (e.g., from Tauri dev/build),
    // default to UI mode so the desktop software opens natively.
    if args.len() <= 1 {
        args.push("--ui".to_string());
    }

    let cli = Cli::parse_from(args);

    // ─── Web UI mode ───
    if cli.ui {
        println!(
            "\n  {} {}",
            "Hedge Coding".bright_cyan().bold(),
            format!("v{}", env!("CARGO_PKG_VERSION")).dimmed()
        );
        println!(
            "  {}\n",
            "Starting Tauri Desktop UI...".bright_white().bold()
        );
        return server::start_ui(cli.dir.clone());
    }

    // Banner
    println!(
        "\n  {} {}",
        "Hedge Coding".bright_cyan().bold(),
        format!("v{}", env!("CARGO_PKG_VERSION")).dimmed()
    );
    println!(
        "  {}\n",
        "Let cheap models read, let expensive models write."
            .dimmed()
            .italic()
    );

    // ─── Step 1: Scan directory ───
    println!(
        "{}",
        format!("  Scanning {}...", cli.dir.display())
            .bright_white()
            .bold()
    );

    let scan_result = scanner::scan_directory(&cli.dir)?;
    scanner::print_scan_summary(&scan_result);

    if scan_result.files.is_empty() {
        println!(
            "  {} No source files found in {}",
            "⚠".yellow(),
            cli.dir.display()
        );
        return Ok(());
    }

    if cli.scan_only {
        return Ok(());
    }

    // ─── Step 2: Generate Repo Map ───
    println!(
        "{}",
        "  Generating Repo Map (Tree-sitter AST)..."
            .bright_white()
            .bold()
    );

    let repo_map = repo_map::generate_repo_map(&cli.dir, &scan_result.files)?;
    repo_map::print_repo_map(&repo_map);

    if cli.map_only {
        // Output raw repo map text
        let map_text = repo_map::render_repo_map(&repo_map);
        if let Some(output_path) = &cli.output {
            std::fs::write(output_path, &map_text)?;
            println!(
                "  {} Repo map saved to {}",
                "✓".green(),
                output_path.display()
            );
        }
        return Ok(());
    }

    // ─── Step 3: Select files ───
    // For now (Phase 1): include all files up to max_files
    // Phase 3 will add LLM-based intelligent file selection
    let selected_files: Vec<_> = if let Some(include_patterns) = &cli.include {
        // Filter files matching include patterns
        scan_result
            .files
            .iter()
            .filter(|f| {
                include_patterns
                    .iter()
                    .any(|p| f.relative_path.contains(p))
            })
            .take(cli.max_files)
            .cloned()
            .collect()
    } else {
        scan_result
            .files
            .iter()
            .take(cli.max_files)
            .cloned()
            .collect()
    };

    println!(
        "  {} {}",
        "Selected files:".dimmed(),
        selected_files.len().to_string().green().bold()
    );

    // ─── Step 4: Compile Super Prompt ───
    let goal = cli.goal.as_deref().unwrap_or("Analyze this codebase and suggest improvements.");

    println!(
        "{}",
        "  Compiling Super Prompt...".bright_white().bold()
    );

    let options = compiler::CompileOptions {
        goal,
        selected_files: &selected_files,
        repo_map: &repo_map,
        checklist: None,
        skills_context: None,
        claude_md: None,
        file_summaries: None,
        git_diff: None,
        task_instructions: None,
    };

    let super_prompt = compiler::compile(&options)?;
    compiler::print_compile_summary(&super_prompt);

    // ─── Step 5: Token estimation ───
    let estimate = token_counter::estimate_cost(&super_prompt.content);
    token_counter::print_estimate(&estimate);

    // Warning if too many tokens
    if estimate.tokens > config::TOKEN_WARNING_THRESHOLD {
        println!(
            "  {} {} Consider using --include to select specific files.",
            "⚠".yellow().bold(),
            format!(
                "Token count ({}) exceeds warning threshold ({}).",
                estimate.tokens,
                config::TOKEN_WARNING_THRESHOLD
            )
            .yellow()
        );
        println!();
    }

    // ─── Step 6: Output ───
    if let Some(output_path) = &cli.output {
        std::fs::write(output_path, &super_prompt.content)?;
        println!(
            "  {} Super Prompt saved to {}",
            "✓".green().bold(),
            output_path.display().to_string().bright_white()
        );
    } else {
        // Print a separator and the prompt to stdout
        println!(
            "{}",
            "━━━ Super Prompt Output ━━━━━━━━━━━━━━━━━"
                .bright_cyan()
                .bold()
        );
        println!();
        println!("{}", super_prompt.content);
    }

    println!(
        "\n  {} {}",
        "Done!".green().bold(),
        "Copy the Super Prompt above and paste into your expensive model."
            .dimmed()
    );

    Ok(())
}
