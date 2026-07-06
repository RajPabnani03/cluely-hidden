//! Calendar hints via macOS AppleScript (Sprint E). Best-effort; requires Calendar access.

use crate::error::Result;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarHint {
    pub summary: String,
    pub start: String,
}

pub fn upcoming_hints(limit: usize) -> Result<Vec<CalendarHint>> {
    #[cfg(target_os = "macos")]
    {
        return macos_upcoming(limit);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = limit;
        Ok(vec![])
    }
}

#[cfg(target_os = "macos")]
fn macos_upcoming(limit: usize) -> Result<Vec<CalendarHint>> {
    let script = format!(
        r#"set out to ""
set n to 0
tell application "Calendar"
  set startDate to current date
  set endDate to startDate + (2 * days)
  repeat with cal in calendars
    set evts to (every event of cal whose start date ≥ startDate and start date ≤ endDate)
    repeat with e in evts
      if n ≥ {limit} then exit repeat
      set out to out & (summary of e as text) & tab & (start date of e as text) & linefeed
      set n to n + 1
    end repeat
  end repeat
end tell
return out"#,
        limit = limit.min(10)
    );

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| crate::error::AppError::Other(format!("osascript: {e}")))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Ok(vec![CalendarHint {
            summary: format!(
                "Calendar unavailable (grant access in System Settings). {err}"
            ),
            start: String::new(),
        }]);
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut hints = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let mut parts = line.splitn(2, '\t');
        let summary = parts.next().unwrap_or(line).to_string();
        let start = parts.next().unwrap_or("").to_string();
        hints.push(CalendarHint { summary, start });
    }
    Ok(hints)
}