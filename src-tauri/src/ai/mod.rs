//! AI integration — Gemini Live WebSocket client, future model adapters.
//!
//! This module is the bridge between the local Tauri runtime and the
//! Gemini Multimodal Live API. It owns the long-lived WebSocket
//! connection and is responsible for translating low-level server
//! events into Tauri events the React frontend can consume.

pub mod gemini_live;
pub mod groq;
pub mod dual_brain;

pub use gemini_live::GeminiLiveClient;
