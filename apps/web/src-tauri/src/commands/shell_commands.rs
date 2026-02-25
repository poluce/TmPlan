use std::process::Command;

const ALLOWED_GIT_COMMANDS: &[&str] = &[
    "status", "log", "diff", "branch", "remote", "rev-parse",
];

#[tauri::command]
pub fn run_git_command(project_path: String, args: Vec<String>) -> Result<String, String> {
    if args.is_empty() {
        return Err("No git subcommand provided".to_string());
    }

    let subcommand = &args[0];
    if !ALLOWED_GIT_COMMANDS.contains(&subcommand.as_str()) {
        return Err(format!(
            "Git subcommand '{}' is not allowed. Allowed: {:?}",
            subcommand, ALLOWED_GIT_COMMANDS
        ));
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map_err(|e| format!("Failed to parse git output: {}", e))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Git command failed: {}", stderr))
    }
}
