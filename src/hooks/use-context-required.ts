import { useContext, type Context } from 'react';

export class ContextRequiredError extends Error {}

export function useContextRequired<T>(context: Context<T | undefined>): T {
  const value = useContext(context);
  if (value === undefined) {
    throw new ContextRequiredError(context.name);
  }
  return value;
}
