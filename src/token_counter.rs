// Hedge Coding — Token counter using tiktoken-rs
// Estimates token count and cost for multiple models

use serde::Serialize;
use tiktoken_rs::o200k_base;

/// Cost estimate for a specific model
#[derive(Debug, Clone, Serialize)]
pub struct CostEstimate {
    pub model: String,
    pub input_cost_usd: f64,
}

/// Token count and cost estimation result
#[derive(Debug, Clone, Serialize)]
pub struct TokenEstimate {
    /// Total token count
    pub tokens: usize,
    /// Cost estimates for different models
    pub costs: Vec<CostEstimate>,
}

/// Internal model pricing table
struct ModelPricing {
    name: &'static str,
    input_per_million: f64,
}

const MODEL_PRICING: &[ModelPricing] = &[
    ModelPricing { name: "Claude Opus 4.6",      input_per_million: 5.0  },
    ModelPricing { name: "Claude Sonnet 4.6",    input_per_million: 3.0  },
    ModelPricing { name: "GPT-4o",               input_per_million: 2.5  },
    ModelPricing { name: "Gemini 2.5 Flash",     input_per_million: 0.3  },
    ModelPricing { name: "Gemini 2.5 Flash-Lite",input_per_million: 0.1  },
];

/// Count tokens in a string using tiktoken (o200k_base tokenizer)
pub fn count_tokens(text: &str) -> usize {
    match o200k_base() {
        Ok(bpe) => bpe.encode_with_special_tokens(text).len(),
        Err(_) => text.len() / 4, // Fallback: ~4 chars per token
    }
}

/// Estimate tokens and cost for a Super Prompt
pub fn estimate_cost(text: &str) -> TokenEstimate {
    let tokens = count_tokens(text);

    let costs = MODEL_PRICING
        .iter()
        .map(|m| CostEstimate {
            model: m.name.to_string(),
            input_cost_usd: (tokens as f64 / 1_000_000.0) * m.input_per_million,
        })
        .collect();

    TokenEstimate { tokens, costs }
}

/// Print token estimate with colors (CLI only)
pub fn print_estimate(estimate: &TokenEstimate) {
    use colored::Colorize;

    println!("\n{}", "━━━ Token & Cost Estimate ━━━━━━━━━━━━━━━━".bright_cyan().bold());
    println!("  {} {}", "Tokens:".dimmed(), format!("{}", estimate.tokens).green().bold());
    println!();
    println!("  {}", "Estimated input cost:".dimmed());
    for cost in &estimate.costs {
        let cost_str = format!("${:.4}", cost.input_cost_usd);
        let colored_cost = if cost.input_cost_usd > 1.0 {
            cost_str.red().bold()
        } else if cost.input_cost_usd > 0.1 {
            cost_str.yellow()
        } else {
            cost_str.green()
        };
        println!("    {:<30} {}", cost.model.white(), colored_cost);
    }
    println!();
}
