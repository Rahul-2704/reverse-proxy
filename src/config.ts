import fs from 'node:fs/promises';
import {parse} from 'yaml';
import { rootConfigSchema } from './config-schema';

export async function parseYAMLConfig(filePath:string){
    const configFileContent=await fs.readFile(filePath,'utf-8');
    const parsedConfig=parse(configFileContent);
    return JSON.stringify(parsedConfig);
}

export async function validateConfig(config:string){
    const validatedConfig=await rootConfigSchema.parseAsync(JSON.parse(config));
    return validatedConfig;
}


