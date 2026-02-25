#[tauri::command]
pub fn start_ai_engine() -> Result<String, String> {
    Ok("not_configured".to_string())
}

#[tauri::command]
pub fn stop_ai_engine() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn get_ai_engine_status() -> Result<String, String> {
    Ok("stopped".to_string())
}
