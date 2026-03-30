// Budget Coder — Super Prompt XML compiler
// Assembles the final structured prompt for expensive models

use crate::repo_map::{render_repo_map, RepoMap};
use crate::scanner::FileEntry;
use anyhow::Result;
use std::fs;

/// Options for compiling a Super Prompt
pub struct CompileOptions<'a> {
    /// The user's goal/instruction
    pub goal: &'a str,
    /// Files selected for full inclusion
    pub selected_files: &'a [FileEntry],
    /// The repo map (for context)
    pub repo_map: &'a RepoMap,
    /// Optional implementation checklist (from LLM or manual)
    pub checklist: Option<&'a str>,
    /// Optional skills context
    pub skills_context: Option<&'a str>,
}

/// The compiled Super Prompt
pub struct SuperPrompt {
    /// The full XML content
    pub content: String,
    /// Number of files included
    pub file_count: usize,
    /// Total characters of source code included
    pub source_chars: usize,
}

/// Compile a Super Prompt from the given options
pub fn compile(options: &CompileOptions) -> Result<SuperPrompt> {
    let mut xml = String::new();
    let mut source_chars = 0;

    // ─── User Goal ───
    xml.push_str("<user_goal>\n");
    xml.push_str(options.goal);
    xml.push('\n');
    xml.push_str("</user_goal>\n\n");

    // ─── Repo Map (compact overview) ───
    xml.push_str("<repo_map>\n");
    xml.push_str(&render_repo_map(options.repo_map));
    xml.push_str("</repo_map>\n\n");

    // ─── Implementation Checklist ───
    if let Some(checklist) = options.checklist {
        xml.push_str("<implementation_checklist>\n");
        xml.push_str(checklist);
        xml.push('\n');
        xml.push_str("</implementation_checklist>\n\n");
    }

    // ─── Skills Context ───
    if let Some(skills) = options.skills_context {
        xml.push_str("<skills_context>\n");
        xml.push_str(skills);
        xml.push('\n');
        xml.push_str("</skills_context>\n\n");
    }

    // ─── Project Context (full file contents) ───
    xml.push_str("<project_context>\n");
    for file in options.selected_files {
        let content = match fs::read_to_string(&file.path) {
            Ok(c) => c,
            Err(e) => {
                xml.push_str(&format!(
                    "  <file path=\"{}\" error=\"{}\" />\n",
                    file.relative_path, e
                ));
                continue;
            }
        };
        source_chars += content.len();

        xml.push_str(&format!("  <file path=\"{}\">\n", file.relative_path));
        xml.push_str(&content);
        if !content.ends_with('\n') {
            xml.push('\n');
        }
        xml.push_str("  </file>\n\n");
    }
    xml.push_str("</project_context>\n\n");

    // ─── Execution Instructions ───
    xml.push_str("<execution_instructions>\n");
    if options.checklist.is_some() {
        xml.push_str(
            "Implement the checklist above step by step. \
             Output modified files in full inside markdown code blocks labeled with the file path. \
             Do not invent new dependencies. \
             You are a senior software engineer.\n",
        );
    } else {
        xml.push_str(
            "Analyze the user goal and the provided project context. \
             Implement the requested changes. \
             Output modified files in full inside markdown code blocks labeled with the file path. \
             Do not invent new dependencies. \
             You are a senior software engineer.\n",
        );
    }
    xml.push_str("</execution_instructions>\n");

    Ok(SuperPrompt {
        content: xml,
        file_count: options.selected_files.len(),
        source_chars,
    })
}

/// Print a summary of the compiled Super Prompt
pub fn print_compile_summary(prompt: &SuperPrompt) {
    use colored::Colorize;

    println!(
        "\n{}",
        "━━━ Super Prompt Compiled ━━━━━━━━━━━━━━━━"
            .bright_cyan()
            .bold()
    );
    println!(
        "  {} {}",
        "Files included:".dimmed(),
        prompt.file_count.to_string().green().bold()
    );
    println!(
        "  {} {}",
        "Source code:".dimmed(),
        format!("{} chars", prompt.source_chars).white()
    );
    println!(
        "  {} {}",
        "Total prompt:".dimmed(),
        format!("{} chars", prompt.content.len()).white()
    );
    println!();
}
