import { useEffect } from 'react';

interface UseQueryErrorOptions {
  error: any;
  isError: boolean;
  onAccessDenied?: () => void;
  onError?: (error: any) => void;
}

export const useQueryError = ({ error, isError, onAccessDenied, onError }: UseQueryErrorOptions) => {
  useEffect(() => {
    if (isError && error) {
      const status = error?.response?.status;
      
      if (status === 403) {
        console.error('Access Denied (403):', error.response?.data);
        if (onAccessDenied) {
          onAccessDenied();
        }
      } else if (onError) {
        onError(error);
      }
    }
  }, [isError, error, onAccessDenied, onError]);

  return {
    isAccessDenied: isError && error?.response?.status === 403,
    errorMessage: error?.response?.data?.message || error?.message || 'An error occurred',
  };
};
