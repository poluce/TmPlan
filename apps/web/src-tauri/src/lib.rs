mod commands;

use commands::dialog_commands;
use commands::fs_commands;
use commands::progress_commands;
use commands::shell_commands;
use commands::sidecar_commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            fs_commands::read_project,
            fs_commands::read_all_modules,
            fs_commands::read_all_decisions,
            fs_commands::read_status,
            fs_commands::write_project,
            fs_commands::write_module,
            fs_commands::write_decision,
            fs_commands::init_tmplan,
            fs_commands::check_tmplan_exists,
            dialog_commands::pick_directory,
            shell_commands::run_git_command,
            progress_commands::check_file_exists,
            progress_commands::check_module_progress,
            progress_commands::check_project_progress,
            sidecar_commands::start_ai_engine,
            sidecar_commands::stop_ai_engine,
            sidecar_commands::get_ai_engine_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
