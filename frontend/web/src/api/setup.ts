import { client } from './generated/client.gen';

client.setConfig({
  baseUrl: '',
  responseStyle: 'data',
  throwOnError: true,
});

client.interceptors.error.use(async (error, response) => {
  const attachStatus = (err: Error) => {
    if (response && typeof response.status === 'number') {
      (err as Error & { status?: number }).status = response.status;
    }
    return err;
  };

  if (error instanceof Error) {
    return attachStatus(error);
  }
  if (typeof error === 'string') {
    return attachStatus(new Error(error));
  }
  if (error && typeof error === 'object') {
    if ('detail' in error) {
      return attachStatus(
        new Error(String((error as { detail?: unknown }).detail ?? 'Unknown error')),
      );
    }
    if ('message' in error) {
      return attachStatus(
        new Error(String((error as { message?: unknown }).message ?? 'Unknown error')),
      );
    }
  }
  return attachStatus(new Error('Unknown error'));
});
