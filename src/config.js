import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_CONFIG_PATH = resolve("config/config.json");
const EXAMPLE_CONFIG_PATH = resolve("config/config.example.json");

export function loadConfig() {
  const path = process.env.WARP_GATEWAY_CONFIG
    ? resolve(process.env.WARP_GATEWAY_CONFIG)
    : existsSync(DEFAULT_CONFIG_PATH)
      ? DEFAULT_CONFIG_PATH
      : EXAMPLE_CONFIG_PATH;

  const raw = readFileSync(path, "utf8");
  const config = JSON.parse(raw);

  config.host ??= "127.0.0.1";
  config.port ??= 8320;
  config.gatewayApiKeys ??= [];
  config.adapters ??= {};

  return { config, path };
}

export function resolveSecret(value, envName) {
  if (value) return value;
  if (envName) return process.env[envName] || "";
  return "";
}
