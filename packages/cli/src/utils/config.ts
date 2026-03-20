import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface VersionsmithConfig {
  /** Path to the output changelog file, relative to cwd. Default: "CHANGELOG.md" */
  changelog: string;
  /** Header text prepended to the changelog file. */
  header: string;
}

export const DEFAULT_CONFIG: VersionsmithConfig = {
  changelog: "CHANGELOG.md",
  header: `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).`,
};

export const VERSIONSMITH_DIR = ".versionsmith";
export const CONFIG_FILE = "config.json";

/**
 * Returns the absolute path to the .versionsmith directory.
 */
export function getVersionsmithDir(cwd: string = process.cwd()): string {
  return join(cwd, VERSIONSMITH_DIR);
}

/**
 * Returns the absolute path to the config file.
 */
export function getConfigPath(cwd: string = process.cwd()): string {
  return join(cwd, VERSIONSMITH_DIR, CONFIG_FILE);
}

/**
 * Reads the config from .versionsmith/config.json.
 * Returns DEFAULT_CONFIG if the file does not exist.
 */
export function readConfig(cwd: string = process.cwd()): VersionsmithConfig {
  const configPath = getConfigPath(cwd);
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<VersionsmithConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Writes the config to .versionsmith/config.json.
 */
export function writeConfig(
  config: VersionsmithConfig,
  cwd: string = process.cwd()
): void {
  const configPath = getConfigPath(cwd);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

/**
 * Returns true if versionsmith has been initialized in the given directory.
 */
export function isInitialized(cwd: string = process.cwd()): boolean {
  return existsSync(getConfigPath(cwd));
}
