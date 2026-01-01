"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserProfile, getUserProfile, UserProfile } from "@/lib/db";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isPro: boolean;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      console.error("Error loading user profile:", error);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Create user profile if new user and load profile
      if (user) {
        try {
          await createUserProfile(user.uid);
          await loadUserProfile(user.uid);
        } catch (error) {
          // Profile might already exist, ignore error
          console.log("User profile check:", error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    if (user) {
      await loadUserProfile(user.uid);
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // Create profile if new user
      if (result.user) {
        await createUserProfile(result.user.uid);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Email login error:", error);
      // Handle specific Firebase errors
      if (error.code === "auth/user-not-found") {
        throw new Error("User not found");
      } else if (error.code === "auth/wrong-password") {
        throw new Error("Wrong password");
      } else if (error.code === "auth/invalid-email") {
        throw new Error("Invalid email address");
      } else if (error.code === "auth/invalid-credential") {
        throw new Error("Invalid email or password");
      }
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      // Create user profile
      if (result.user) {
        await createUserProfile(result.user.uid);
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      // Handle specific Firebase errors
      if (error.code === "auth/email-already-in-use") {
        throw new Error("Email already in use");
      } else if (error.code === "auth/invalid-email") {
        throw new Error("Invalid email address");
      } else if (error.code === "auth/weak-password") {
        throw new Error("Password should be at least 6 characters");
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const isPro = userProfile?.isPro ?? false;

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        userProfile, 
        isPro,
        loading, 
        login, 
        loginWithEmail, 
        registerWithEmail, 
        logout,
        refreshUserProfile 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

