/**
 * Global Error Handler
 * Catches and formats errors properly for display
 */

// Setup global error handler
export function setupGlobalErrorHandler() {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
    
    // Format error message
    const errorMessage = formatError(event.reason);
    console.error('Formatted error:', errorMessage);
  });

  // Catch regular errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    event.preventDefault();
    
    const errorMessage = formatError(event.error);
    console.error('Formatted error:', errorMessage);
  });
}

// Format error for display
export function formatError(error) {
  if (!error) return 'Unknown error';
  
  // If it's already a string
  if (typeof error === 'string') return error;
  
  // If it's an Error object
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  
  // If it has a message property
  if (error.message) {
    return error.message;
  }
  
  // If it's an object, try to stringify it
  try {
    return JSON.stringify(error, null, 2);
  } catch (e) {
    return 'Error: Unable to format error message';
  }
}

// Safe async wrapper
export function safeAsync(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Safe async error:', formatError(error));
      throw error;
    }
  };
}

export default {
  setupGlobalErrorHandler,
  formatError,
  safeAsync
};
