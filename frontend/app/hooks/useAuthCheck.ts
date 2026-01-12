"use client";

import { useEffect } from 'react';

/**
 * A client-side hook to check if the user is authenticated with the backend.
 * If the user is not authenticated, it automatically redirects them to the 
 * Google login page.
 */
export function useAuthCheck() {
  useEffect(() => {
    // This effect should only run on the client side.
    if (typeof window === 'undefined') {
      return;
    }

    async function checkAuthStatus() {
      try {
        const response = await fetch('http://localhost:8080/api/auth/status', {
          credentials: 'include',
        });

        // If the server returns an error status, or if the user is not authenticated,
        // redirect to the Google login page.
        if (!response.ok) {
            console.error("Auth check failed with status:", response.status);
            window.location.href = 'http://localhost:8080/auth/google';
            return;
        }

        const data = await response.json();

        if (!data.isAuthenticated) {
          window.location.href = 'http://localhost:8080/auth/google';
        }
        // If authenticated, do nothing and let the page render.

      } catch (error) {
        console.error('Failed to connect to auth status endpoint, redirecting to login:', error);
        // Redirect to login on any kind of network failure as well,
        // as we cannot verify the user's status.
        window.location.href = 'http://localhost:8080/auth/google';
      }
    }

    checkAuthStatus();
  }, []); // The empty dependency array ensures this runs only once on component mount.
}
