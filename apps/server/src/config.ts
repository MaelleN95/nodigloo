import 'dotenv/config';

export type NodeEnv = 'development' | 'production' | 'test';

export interface Config {
  port: number;
  allowedOrigins: string[];
  nodeEnv: NodeEnv;
}

const parsePort = (value: string | undefined): number => {
  if (value === undefined || value === '') {
    return 3001;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT invalide : "${value}"`);
  }

  return port;
};

const parseNodeEnv = (value: string | undefined): NodeEnv => {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
};

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? 'http://localhost:8080')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => ({
  port: parsePort(env.PORT),
  allowedOrigins: parseOrigins(env.CLIENT_ORIGINS),
  nodeEnv: parseNodeEnv(env.NODE_ENV),
});
