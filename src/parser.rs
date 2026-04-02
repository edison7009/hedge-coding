// Hedge Coding — Tree-sitter AST parser for symbol extraction

use anyhow::Result;
use serde::Serialize;
use std::path::Path;

/// A symbol extracted from source code
#[derive(Debug, Clone, Serialize)]
pub struct Symbol {
    /// Symbol name (e.g., "App", "handleClick", "UserStore")
    pub name: String,
    /// Symbol kind
    pub kind: SymbolKind,
    /// Line number (1-indexed)
    pub line: usize,
}

/// Types of symbols we extract
#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum SymbolKind {
    Function,
    Method,
    Class,
    Interface,
    TypeAlias,
    Struct,
    Enum,
    Trait,
    Impl,
    Constant,
    #[allow(dead_code)]
    Export,
    Module,
    Macro,
}

impl std::fmt::Display for SymbolKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SymbolKind::Function => write!(f, "fn"),
            SymbolKind::Method => write!(f, "method"),
            SymbolKind::Class => write!(f, "class"),
            SymbolKind::Interface => write!(f, "interface"),
            SymbolKind::TypeAlias => write!(f, "type"),
            SymbolKind::Struct => write!(f, "struct"),
            SymbolKind::Enum => write!(f, "enum"),
            SymbolKind::Trait => write!(f, "trait"),
            SymbolKind::Impl => write!(f, "impl"),
            SymbolKind::Constant => write!(f, "const"),
            SymbolKind::Export => write!(f, "export"),
            SymbolKind::Module => write!(f, "mod"),
            SymbolKind::Macro => write!(f, "macro"),
        }
    }
}

/// Parse a file and extract symbols based on its language
pub fn extract_symbols(path: &Path, source: &str) -> Result<Vec<Symbol>> {
    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "js" => extract_javascript_symbols(source),
        "jsx" => extract_jsx_symbols(source),
        "ts" => extract_typescript_symbols(source),
        "tsx" => extract_tsx_symbols(source),
        "py" => extract_python_symbols(source),
        "rs" => extract_rust_symbols(source),
        _ => {
            // For unsupported languages, try a basic regex-like extraction
            Ok(extract_generic_symbols(source))
        }
    }
}

/// Extract symbols from JavaScript/JSX files
fn extract_javascript_symbols(source: &str) -> Result<Vec<Symbol>> {
    let mut parser = tree_sitter::Parser::new();
    let language = tree_sitter_javascript::LANGUAGE;
    parser
        .set_language(&language.into())
        .map_err(|e| anyhow::anyhow!("Failed to set JS language: {}", e))?;

    let tree = parser
        .parse(source, None)
        .ok_or_else(|| anyhow::anyhow!("Failed to parse JS"))?;

    let mut symbols = Vec::new();
    collect_js_symbols(&tree.root_node(), source, &mut symbols);
    Ok(symbols)
}

/// Extract symbols from TypeScript files (.ts only)
fn extract_typescript_symbols(source: &str) -> Result<Vec<Symbol>> {
    let mut parser = tree_sitter::Parser::new();
    let language = tree_sitter_typescript::LANGUAGE_TYPESCRIPT;
    parser
        .set_language(&language.into())
        .map_err(|e| anyhow::anyhow!("Failed to set TS language: {}", e))?;

    let tree = parser
        .parse(source, None)
        .ok_or_else(|| anyhow::anyhow!("Failed to parse TS"))?;

    let mut symbols = Vec::new();
    collect_ts_symbols(&tree.root_node(), source, &mut symbols);
    Ok(symbols)
}

/// Extract symbols from TSX files (.tsx) — uses the TSX grammar
/// which understands JSX syntax like <Component /> tags
fn extract_tsx_symbols(source: &str) -> Result<Vec<Symbol>> {
    let mut parser = tree_sitter::Parser::new();
    let language = tree_sitter_typescript::LANGUAGE_TSX;
    parser
        .set_language(&language.into())
        .map_err(|e| anyhow::anyhow!("Failed to set TSX language: {}", e))?;

    let tree = parser
        .parse(source, None)
        .ok_or_else(|| anyhow::anyhow!("Failed to parse TSX"))?;

    let mut symbols = Vec::new();
    collect_ts_symbols(&tree.root_node(), source, &mut symbols);
    Ok(symbols)
}

/// Extract symbols from JSX files (.jsx) — uses the JS grammar
/// which should handle JSX in most tree-sitter JS grammars
fn extract_jsx_symbols(source: &str) -> Result<Vec<Symbol>> {
    // tree-sitter-javascript grammar handles JSX natively
    extract_javascript_symbols(source)
}

/// Extract symbols from Python files
fn extract_python_symbols(source: &str) -> Result<Vec<Symbol>> {
    let mut parser = tree_sitter::Parser::new();
    let language = tree_sitter_python::LANGUAGE;
    parser
        .set_language(&language.into())
        .map_err(|e| anyhow::anyhow!("Failed to set Python language: {}", e))?;

    let tree = parser
        .parse(source, None)
        .ok_or_else(|| anyhow::anyhow!("Failed to parse Python"))?;

    let mut symbols = Vec::new();
    collect_python_symbols(&tree.root_node(), source, &mut symbols);
    Ok(symbols)
}

/// Extract symbols from Rust files
fn extract_rust_symbols(source: &str) -> Result<Vec<Symbol>> {
    let mut parser = tree_sitter::Parser::new();
    let language = tree_sitter_rust::LANGUAGE;
    parser
        .set_language(&language.into())
        .map_err(|e| anyhow::anyhow!("Failed to set Rust language: {}", e))?;

    let tree = parser
        .parse(source, None)
        .ok_or_else(|| anyhow::anyhow!("Failed to parse Rust"))?;

    let mut symbols = Vec::new();
    collect_rust_symbols(&tree.root_node(), source, &mut symbols);
    Ok(symbols)
}

// ─── JavaScript symbol collection ────────────────────────────────────
// Aligned with Aider's javascript-tags.scm for comprehensive capture

fn collect_js_symbols(node: &tree_sitter::Node, source: &str, symbols: &mut Vec<Symbol>) {
    let kind = node.kind();
    match kind {
        // Standard function declarations & generators
        "function_declaration" | "generator_function_declaration" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Function,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Named function expressions: const x = function myFn() {}
        "function_expression" | "generator_function" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Function,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Class declarations (+ anonymous class expressions are skipped)
        "class_declaration" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Class,
                    line: node.start_position().row + 1,
                });
            }
        }
        "class" => {
            // Named class expression: const X = class MyClass {}
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Class,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Class methods: class Foo { bar() {} }
        "method_definition" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                let name = node_text(&name_node, source);
                if name != "constructor" {
                    symbols.push(Symbol {
                        name,
                        kind: SymbolKind::Method,
                        line: node.start_position().row + 1,
                    });
                }
            }
        }
        // Arrow functions and function expressions assigned to variables
        // const handleClick = () => {} OR const render = function() {}
        "lexical_declaration" | "variable_declaration" => {
            for i in 0..node.named_child_count() {
                if let Some(declarator) = node.named_child(i) {
                    if declarator.kind() == "variable_declarator" {
                        if let Some(name_node) = declarator.child_by_field_name("name") {
                            let name = node_text(&name_node, source);
                            if let Some(value_node) = declarator.child_by_field_name("value") {
                                let vk = value_node.kind();
                                if vk == "arrow_function" || vk == "function_expression" || vk == "generator_function" {
                                    symbols.push(Symbol {
                                        name,
                                        kind: SymbolKind::Function,
                                        line: declarator.start_position().row + 1,
                                    });
                                } else if is_important_name(&name) {
                                    // PascalCase/UPPER_CASE constants
                                    symbols.push(Symbol {
                                        name,
                                        kind: SymbolKind::Constant,
                                        line: declarator.start_position().row + 1,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        // Assignment-style: module.exports.fn = () => {}
        "assignment_expression" => {
            if let Some(right) = node.child_by_field_name("right") {
                let rk = right.kind();
                if rk == "arrow_function" || rk == "function_expression" {
                    if let Some(left) = node.child_by_field_name("left") {
                        let name = match left.kind() {
                            "identifier" => Some(node_text(&left, source)),
                            "member_expression" => {
                                left.child_by_field_name("property").map(|p| node_text(&p, source))
                            }
                            _ => None,
                        };
                        if let Some(n) = name {
                            symbols.push(Symbol {
                                name: n,
                                kind: SymbolKind::Function,
                                line: node.start_position().row + 1,
                            });
                        }
                    }
                }
            }
        }
        // Object property shorthand: { handleClick() {} } or { render: () => {} }
        "pair" => {
            if let Some(value) = node.child_by_field_name("value") {
                let vk = value.kind();
                if vk == "arrow_function" || vk == "function_expression" {
                    if let Some(key) = node.child_by_field_name("key") {
                        symbols.push(Symbol {
                            name: node_text(&key, source),
                            kind: SymbolKind::Function,
                            line: node.start_position().row + 1,
                        });
                    }
                }
            }
        }
        "export_statement" => {
            // Don't add export itself, just traverse children
        }
        _ => {}
    }

    // Recurse into children
    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            collect_js_symbols(&child, source, symbols);
        }
    }
}

// ─── TypeScript symbol collection ────────────────────────────────────
// Aligned with Aider's typescript-tags.scm for comprehensive capture

fn collect_ts_symbols(node: &tree_sitter::Node, source: &str, symbols: &mut Vec<Symbol>) {
    let kind = node.kind();
    match kind {
        // Standard and signature-only function declarations
        "function_declaration" | "function_signature" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Function,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Class declarations (concrete + abstract)
        "class_declaration" | "abstract_class_declaration" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Class,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Interface declarations
        "interface_declaration" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Interface,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Type aliases
        "type_alias_declaration" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::TypeAlias,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Enums
        "enum_declaration" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Enum,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Class methods: class Foo { bar() {} }
        "method_definition" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                let name = node_text(&name_node, source);
                if name != "constructor" {
                    symbols.push(Symbol {
                        name,
                        kind: SymbolKind::Method,
                        line: node.start_position().row + 1,
                    });
                }
            }
        }
        // Interface method signatures: interface Foo { bar(): void }
        "method_signature" | "abstract_method_signature" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Method,
                    line: node.start_position().row + 1,
                });
            }
        }
        // Module declarations: module Foo {}
        "module" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                if name_node.kind() == "identifier" {
                    symbols.push(Symbol {
                        name: node_text(&name_node, source),
                        kind: SymbolKind::Module,
                        line: node.start_position().row + 1,
                    });
                }
            }
        }
        // Arrow functions and function expressions assigned to variables
        "lexical_declaration" | "variable_declaration" => {
            for i in 0..node.named_child_count() {
                if let Some(declarator) = node.named_child(i) {
                    if declarator.kind() == "variable_declarator" {
                        if let Some(name_node) = declarator.child_by_field_name("name") {
                            let name = node_text(&name_node, source);
                            if let Some(value_node) = declarator.child_by_field_name("value") {
                                let vk = value_node.kind();
                                if vk == "arrow_function" || vk == "function_expression" {
                                    symbols.push(Symbol {
                                        name,
                                        kind: SymbolKind::Function,
                                        line: declarator.start_position().row + 1,
                                    });
                                } else if is_important_name(&name) {
                                    symbols.push(Symbol {
                                        name,
                                        kind: SymbolKind::Constant,
                                        line: declarator.start_position().row + 1,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        _ => {}
    }

    for i in 0..node.child_count() {
        if let Some(child) = node.child(i) {
            collect_ts_symbols(&child, source, symbols);
        }
    }
}

// ─── Python symbol collection ────────────────────────────────────────

fn collect_python_symbols(node: &tree_sitter::Node, source: &str, symbols: &mut Vec<Symbol>) {
    let kind = node.kind();
    match kind {
        "function_definition" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Function,
                    line: node.start_position().row + 1,
                });
            }
        }
        "class_definition" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Class,
                    line: node.start_position().row + 1,
                });
            }
        }
        _ => {}
    }

    // Only recurse into top-level or class body (not deeply nested functions)
    if kind == "module" || kind == "class_definition" || kind == "block" {
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i) {
                collect_python_symbols(&child, source, symbols);
            }
        }
    }
}

// ─── Rust symbol collection ──────────────────────────────────────────
// Aligned with Aider's rust-tags.scm for comprehensive capture

fn collect_rust_symbols(node: &tree_sitter::Node, source: &str, symbols: &mut Vec<Symbol>) {
    collect_rust_symbols_inner(node, source, symbols, false);
}

fn collect_rust_symbols_inner(
    node: &tree_sitter::Node,
    source: &str,
    symbols: &mut Vec<Symbol>,
    inside_impl: bool,
) {
    let kind = node.kind();
    match kind {
        "function_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: if inside_impl { SymbolKind::Method } else { SymbolKind::Function },
                    line: node.start_position().row + 1,
                });
            }
        }
        "struct_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Struct,
                    line: node.start_position().row + 1,
                });
            }
        }
        "enum_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Enum,
                    line: node.start_position().row + 1,
                });
            }
        }
        "union_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Struct, // Union is treated as struct-like ADT
                    line: node.start_position().row + 1,
                });
            }
        }
        "type_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::TypeAlias,
                    line: node.start_position().row + 1,
                });
            }
        }
        "trait_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Trait,
                    line: node.start_position().row + 1,
                });
            }
        }
        "impl_item" => {
            if let Some(type_node) = node.child_by_field_name("type") {
                symbols.push(Symbol {
                    name: node_text(&type_node, source),
                    kind: SymbolKind::Impl,
                    line: node.start_position().row + 1,
                });
            }
            // Recurse into impl body with inside_impl = true
            for i in 0..node.child_count() {
                if let Some(child) = node.child(i) {
                    collect_rust_symbols_inner(&child, source, symbols, true);
                }
            }
            return; // Already recursed, skip default recursion
        }
        "const_item" | "static_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Constant,
                    line: node.start_position().row + 1,
                });
            }
        }
        "mod_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Module,
                    line: node.start_position().row + 1,
                });
            }
        }
        "macro_definition" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                symbols.push(Symbol {
                    name: node_text(&name_node, source),
                    kind: SymbolKind::Macro,
                    line: node.start_position().row + 1,
                });
            }
        }
        _ => {}
    }

    // Recurse into top-level items and mod blocks
    if kind == "source_file" || kind == "mod_item" || kind == "declaration_list" {
        for i in 0..node.child_count() {
            if let Some(child) = node.child(i) {
                collect_rust_symbols_inner(&child, source, symbols, inside_impl);
            }
        }
    }
}

// ─── Generic fallback (regex-like) ───────────────────────────────────

fn extract_generic_symbols(source: &str) -> Vec<Symbol> {
    let mut symbols = Vec::new();

    for (line_num, line) in source.lines().enumerate() {
        let trimmed = line.trim();

        // Match common patterns
        if let Some(name) = extract_pattern(trimmed, "function ") {
            symbols.push(Symbol {
                name,
                kind: SymbolKind::Function,
                line: line_num + 1,
            });
        } else if let Some(name) = extract_pattern(trimmed, "class ") {
            symbols.push(Symbol {
                name,
                kind: SymbolKind::Class,
                line: line_num + 1,
            });
        } else if let Some(name) = extract_pattern(trimmed, "def ") {
            symbols.push(Symbol {
                name,
                kind: SymbolKind::Function,
                line: line_num + 1,
            });
        } else if let Some(name) = extract_pattern(trimmed, "fn ") {
            symbols.push(Symbol {
                name,
                kind: SymbolKind::Function,
                line: line_num + 1,
            });
        } else if let Some(name) = extract_pattern(trimmed, "struct ") {
            symbols.push(Symbol {
                name,
                kind: SymbolKind::Struct,
                line: line_num + 1,
            });
        }
    }

    symbols
}

/// Extract a name after a keyword pattern
fn extract_pattern(line: &str, pattern: &str) -> Option<String> {
    if let Some(rest) = line.strip_prefix(pattern) {
        let name: String = rest
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '_')
            .collect();
        if !name.is_empty() {
            return Some(name);
        }
    }
    // Also match: pub fn, async fn, export function, etc.
    if let Some(idx) = line.find(pattern) {
        let rest = &line[idx + pattern.len()..];
        let name: String = rest
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '_')
            .collect();
        if !name.is_empty() && idx < 20 {
            // only if the keyword is near the start
            return Some(name);
        }
    }
    None
}

// ─── Utilities ───────────────────────────────────────────────────────

/// Get text content of a tree-sitter node
fn node_text(node: &tree_sitter::Node, source: &str) -> String {
    source[node.byte_range()].to_string()
}

/// Check if a name looks "important" (PascalCase or UPPER_CASE)
fn is_important_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    let first = name.chars().next().unwrap();
    // PascalCase: starts with uppercase letter
    // UPPER_CASE: all uppercase
    first.is_uppercase()
}
