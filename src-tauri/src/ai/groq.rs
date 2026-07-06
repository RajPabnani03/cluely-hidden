//! Groq OpenAI-compatible chat (text-only fallback stub).

use crate::error::{AppError, Result};

/// Complete a one-shot text prompt via Groq when `GROQ_API_KEY` is set.
pub async fn complete_text(model: &str, user_message: &str) -> Result<String> {
    let api_key = std::env::var("GROQ_API_KEY").map_err(|_| {
        AppError::Other(
            "Groq provider selected but GROQ_API_KEY is not set in the environment.".into(),
        )
    })?;

    let model = if model.is_empty() || model.starts_with("gemini") {
        "llama-3.3-70b-versatile".to_string()
    } else {
        model.to_string()
    };

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 1024
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Other(format!("groq request: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Other(format!("groq HTTP {status}: {text}")));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Other(format!("groq parse: {e}")))?;

    let content = json
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("(empty Groq response)");

    Ok(content.to_string())
}

/// Offline stub when no API key — still useful for dev.
pub fn stub_reply(user_message: &str) -> String {
    format!(
        "(Groq stub) You said: \"{}\"\n\nSet GROQ_API_KEY and choose provider `groq` in Settings for real replies.",
        user_message
    )
}