const transientCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'PROTOCOL_CONNECTION_LOST']);

export async function retryTransientRead<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const databaseError = error as { code?: string; driverError?: { code?: string } };
    const code = databaseError.driverError?.code ?? databaseError.code;
    if (!code || !transientCodes.has(code)) throw error;
    return operation();
  }
}
