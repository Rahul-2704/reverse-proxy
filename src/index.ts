import { program } from "commander";
import { parseYAMLConfig, validateConfig } from "./config";
import os from "node:os";
import createServer from './server';


async function main() {
  program
    .name("nginx-reverse-proxy")
    .description("A reverse proxy server")
    .version("1.0.0")
    .option("-c, --config <path>", "path to configuration file", "config.yaml");

  program.parse();

  const options = program.opts();

  if (options && "config" in options) {
    const validatedConfig = await validateConfig(
      await parseYAMLConfig(options.config)
    );

    await createServer({
      port: validatedConfig.server.listen,
      workerCount: validatedConfig.server.workers ?? os.cpus().length,
      config:validatedConfig
    });
  }
}

main().catch(console.error);
