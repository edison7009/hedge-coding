// Budget Coder — Default configuration and model pricing

/// Default patterns to ignore when scanning directories
pub const DEFAULT_IGNORE_PATTERNS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    ".next",
    ".nuxt",
    "__pycache__",
    ".venv",
    "venv",
    ".env",
    "*.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.wasm",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.ico",
    "*.svg",
    "*.woff",
    "*.woff2",
    "*.ttf",
    "*.eot",
    "*.mp3",
    "*.mp4",
    "*.webm",
    "*.zip",
    "*.tar",
    "*.gz",
    "*.pdf",
    "*.exe",
    "*.dll",
    "*.so",
    "*.dylib",
    "*.bin",
    "*.o",
    "*.obj",
    "*.class",
    "*.pyc",
    ".DS_Store",
    "Thumbs.db",
];

/// Maximum directory depth to scan
pub const MAX_DEPTH: usize = 8;

/// Maximum number of files to scan
pub const MAX_FILES: usize = 5000;

/// Maximum file size to read (512 KB)
pub const MAX_FILE_SIZE: u64 = 512 * 1024;

/// Token warning threshold
pub const TOKEN_WARNING_THRESHOLD: usize = 80_000;

/// Model pricing per million tokens (input, output) in USD
#[derive(Debug, Clone)]
pub struct ModelPricing {
    pub name: &'static str,
    pub input_per_million: f64,
    pub output_per_million: f64,
}

pub const MODEL_PRICING: &[ModelPricing] = &[
    ModelPricing {
        name: "Claude Opus 4.6",
        input_per_million: 5.0,
        output_per_million: 25.0,
    },
    ModelPricing {
        name: "Claude Sonnet 4.6",
        input_per_million: 3.0,
        output_per_million: 15.0,
    },
    ModelPricing {
        name: "GPT-4o",
        input_per_million: 2.5,
        output_per_million: 10.0,
    },
    ModelPricing {
        name: "Gemini 2.5 Flash",
        input_per_million: 0.3,
        output_per_million: 2.5,
    },
    ModelPricing {
        name: "Gemini 2.5 Flash-Lite",
        input_per_million: 0.1,
        output_per_million: 0.4,
    },
];
