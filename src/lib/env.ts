export function resolveEnv(input?: { env?: NodeJS.ProcessEnv }): NodeJS.ProcessEnv {
  return input?.env ?? process.env;
}
