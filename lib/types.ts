export type DbValue = string | number | boolean | null | undefined;

export type DbParams = Array<string | number | boolean | null>;

export type ApiErrorLike = {
  message?: string;
  response?: {
    data?: {
      error?: string;
    };
  };
};

export type ClientRow = {
  client?: string | null;
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null) {
    const err = error as ApiErrorLike;
    return err.response?.data?.error || err.message || fallback;
  }
  return fallback;
}
