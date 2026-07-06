//! Dual-brain: while Live is active, ⌘+Enter captures screen and returns a short speakable answer.

use tauri::{AppHandle, Emitter};

use crate::capture::CaptureMeta;
use crate::db::profiles::Profile;
use crate::error::Result;
use crate::settings::AppSettings;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DualBrainResult {
    pub speakable: String,
    pub capture: CaptureMeta,
}

pub async fn dual_brain_step(
    app: &AppHandle,
    settings: &AppSettings,
    profile: &Profile,
    live_transcript: &str,
    extra_context: &str,
) -> Result<DualBrainResult> {
    let meta = crate::capture::capture_primary_display()
        .map_err(|e| crate::error::AppError::Other(e.to_string()))?;
    let _ = app.emit("capture:screen", &meta);

    let max_words = profile.max_words.max(40).min(400);
    let tone = if profile.tone.trim().is_empty() {
        "confident and concise"
    } else {
        profile.tone.as_str()
    };

    let prompt = format!(
        "You are a real-time meeting copilot. The user is on a live call and needs words they can \
         speak aloud in the next 10 seconds.\n\n\
         Tone: {tone}\n\
         Max length: about {max_words} words.\n\
         Live transcript so far:\n{live_transcript}\n\n\
         Extra context (screenshots / notes):\n{extra_context}\n\n\
         Reply with ONLY the speakable answer — no preamble, no markdown, no quotes."
    );

    let speakable = if settings.ai_provider == "groq" && std::env::var("GROQ_API_KEY").is_ok() {
        crate::ai::groq::complete_text(&settings.model, &prompt).await?
    } else if !settings.gemini_api_key.trim().is_empty() {
        crate::ai::dual_brain::gemini_flash_text(settings.gemini_api_key.trim(), &prompt).await?
    } else {
        crate::ai::groq::stub_reply(&prompt)
    };

    let speakable = speakable.trim().to_string();
    let final_text = if speakable.is_empty() {
        "I need a moment to think about that.".to_string()
    } else {
        speakable
    };
    let _ = app.emit("ai:speakable", &final_text);
    Ok(DualBrainResult {
        speakable: final_text,
        capture: meta,
    })
}

/// One-shot Gemini REST (text) for speakable answers when Live is already open.
pub async fn gemini_flash_text(api_key: &str, user_message: &str) -> Result<String> {
    let body = serde_json::json!({
        "contents": [{
            "parts": [{ "text": user_message }]
        }],
        "generationConfig": {
            "maxOutputTokens": 256,
            "temperature": 0.4
        }
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key
    );

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| crate::error::AppError::Other(format!("gemini text: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(crate::error::AppError::Other(format!(
            "gemini HTTP {status}: {text}"
        )));
    }

    let v: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| crate::error::AppError::Other(format!("gemini parse: {e}")))?;

    let text = v
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    Ok(text)
}