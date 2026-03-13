export interface FENResponse<T> {
  success: boolean;
  data: T | null;
  error: ErrorDetails | null;
  metadata: Metadata;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
}

export interface Metadata {
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  timestamp: string;
}
