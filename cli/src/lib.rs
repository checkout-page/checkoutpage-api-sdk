pub mod api;
pub mod app;
pub mod callback;
pub mod cli;
pub mod commands;
pub mod config;
pub mod money;
pub mod output;
pub mod util;

use clap::Parser;

use crate::app::{App, exit_code};
use crate::cli::Cli;
use crate::util::Style;

pub async fn run(cli: Cli) -> anyhow::Result<()> {
    let app = App::new(cli.global)?;
    commands::dispatch(&app, cli.command).await
}

pub fn main_entry() -> i32 {
    let cli = Cli::parse();
    let style = Style::for_stderr(cli.global.no_color);
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(rt) => rt,
        Err(e) => {
            output::err(format!("{} {e}", style.red("Error:")));
            return 1;
        }
    };
    match runtime.block_on(run(cli)) {
        Ok(()) => 0,
        Err(e) => {
            output::err(format!("{} {e:#}", style.red("Error:")));
            exit_code(&e)
        }
    }
}
