import React from 'react';

/**
 * Ce fichier fournit des mock des fonctionnalités de Clerk
 * pour permettre le build sur Netlify sans erreurs
 */

// Mock pour useAuth
export const useAuth = () => {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: 'mock-user-id',
    sessionId: 'mock-session-id',
    getToken: async () => 'mock-token'
  };
};

// Mock pour useUser
export const useUser = () => {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: 'mock-user-id',
      firstName: 'Demo',
      lastName: 'User',
      username: 'demo',
      fullName: 'Demo User',
      imageUrl: 'https://via.placeholder.com/150',
      primaryEmailAddress: {
        emailAddress: 'demo@example.com'
      },
      getMetadata: () => ({}),
    }
  };
};

// Mock pour SignIn
export const SignIn = ({ redirectUrl }: { redirectUrl?: string }) => {
  return null;
};

// Mock pour SignUp
export const SignUp = ({ redirectUrl }: { redirectUrl?: string }) => {
  return null;
};

// Mock pour SignedIn
export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

// Mock pour SignedOut
export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  return null;
};

// Mock pour UserButton
export const UserButton = () => {
  return null;
};

// Mock pour useClerk
export const useClerk = () => {
  return {
    openSignIn: () => {},
    openSignUp: () => {},
    signOut: async () => {},
    session: {
      id: 'mock-session-id',
      userId: 'mock-user-id',
    }
  };
};

// Mock pour ClerkProvider
export const ClerkProvider = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(React.Fragment, null, children);
};

// Mock pour withClerk
export const withClerk = (Component: any) => {
  return Component;
};

// Mock pour auth() fonction
export const auth = () => {
  return {
    userId: 'mock-user-id',
    sessionId: 'mock-session-id',
    getToken: async () => 'mock-token'
  };
};

// Export par défaut pour les imports de type import Clerk from '@clerk/nextjs'
export default {
  useAuth,
  useUser,
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  UserButton,
  useClerk,
  ClerkProvider,
  withClerk,
  auth
}; 