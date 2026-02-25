use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.dialog().file().blocking_pick_folder();
    Ok(dir.map(|p| p.to_string()))
}
