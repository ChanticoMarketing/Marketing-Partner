import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { UseMutationResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type UserProfile = {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  isPrimary: boolean;
  role: string;
  bio: string | null;
  profileImage: string | null;
  coverImage: string | null;
  nickname: string | null;
  jobTitle: string | null;
  department: string | null;
  phoneNumber: string | null;
  preferredLanguage: string;
  theme: string;
  customFields: unknown;
  lastLogin: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  fullName: string;
  username: string;
  email: string;
  password: string;
};

type AuthContextType = {
  user: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserProfile, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserProfile, Error, RegisterData>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

const PROFILE_SYNC_ERROR_MESSAGE =
  "No se pudo terminar de cargar tu perfil. Vuelve a iniciar sesion.";

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as UserProfile;
}

async function fetchProfileWithRetry(userId: string, retries = 3): Promise<UserProfile | null> {
  for (let i = 0; i < retries; i++) {
    const profile = await fetchProfile(userId);
    if (profile) return profile;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function normalizeUsername(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `user_${Date.now().toString().slice(-8)}`;
}

function buildProfilePayload(
  authUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  overrides: Partial<Pick<RegisterData, "fullName" | "username" | "email">> = {}
) {
  const metadata = authUser.user_metadata ?? {};
  const email = overrides.email ?? authUser.email ?? null;
  const emailLocalPart = email?.split("@")[0] ?? authUser.id;

  return {
    id: authUser.id,
    full_name:
      overrides.fullName ??
      (typeof metadata.full_name === "string" ? metadata.full_name : null) ??
      email ??
      "Usuario",
    username:
      overrides.username ??
      (typeof metadata.username === "string" ? metadata.username : null) ??
      normalizeUsername(emailLocalPart),
    email,
    first_name: typeof metadata.first_name === "string" ? metadata.first_name : null,
    last_name: typeof metadata.last_name === "string" ? metadata.last_name : null,
    profile_image_url: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
    department: email?.endsWith("@cohetebrands.com") ? "Cohete Brands" : null,
  };
}

async function ensureProfile(
  authUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  overrides: Partial<Pick<RegisterData, "fullName" | "username" | "email">> = {}
): Promise<UserProfile> {
  const existingProfile = await fetchProfileWithRetry(authUser.id);
  if (existingProfile) return existingProfile;

  const { error } = await supabase.from("users").upsert(buildProfilePayload(authUser, overrides), {
    onConflict: "id",
  });

  if (error) throw error;

  const syncedProfile = await fetchProfileWithRetry(authUser.id, 5);
  if (!syncedProfile) throw new Error("Perfil no encontrado tras sincronización");
  return syncedProfile;
}

async function clearBrokenSession() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Error clearing broken auth session:", error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          const profile = await ensureProfile(session.user);
          if (mounted) {
            setUser(profile);
            setError(null);
          }
        } else {
          setUser(null);
          setError(null);
        }
      } catch (err) {
        await clearBrokenSession();
        if (mounted) {
          setUser(null);
          setError(
            err instanceof Error
              ? new Error(`${PROFILE_SYNC_ERROR_MESSAGE} ${err.message}`)
              : new Error(PROFILE_SYNC_ERROR_MESSAGE)
          );
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setIsLoading(true);
      try {
        if (session?.user) {
          const profile = await ensureProfile(session.user);
          if (mounted) {
            setUser(profile);
            setError(null);
          }
        } else {
          setUser(null);
          setError(null);
        }
      } catch (err) {
        await clearBrokenSession();
        if (mounted) {
          setUser(null);
          setError(
            err instanceof Error
              ? new Error(`${PROFILE_SYNC_ERROR_MESSAGE} ${err.message}`)
              : new Error(PROFILE_SYNC_ERROR_MESSAGE)
          );
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginMutation = useToastMutation<UserProfile, Error, LoginData>(
    async ({ email, password }) => {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (!data.user) throw new Error("No se pudo iniciar sesión");
      try {
        return await ensureProfile(data.user);
      } catch (err) {
        await clearBrokenSession();
        throw err instanceof Error
          ? new Error(`${PROFILE_SYNC_ERROR_MESSAGE} ${err.message}`)
          : new Error(PROFILE_SYNC_ERROR_MESSAGE);
      }
    },
    {
      onSuccess: (profile) => {
        setUser(profile);
        setError(null);
        toast({
          title: "Login successful",
          description: `Welcome back, ${profile.fullName}!`,
        });
      },
      onError: (err: Error) => {
        toast({
          title: "Login failed",
          description: err.message,
          variant: "destructive",
        });
      },
    }
  );

  const registerMutation = useToastMutation<UserProfile, Error, RegisterData>(
    async ({ fullName, username, email, password }) => {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error("No se pudo crear la cuenta");

      return ensureProfile(data.user, { fullName, username, email });
    },
    {
      onSuccess: (profile) => {
        setUser(profile);
        setError(null);
        toast({
          title: "Registration successful",
          description: `Welcome, ${profile.fullName}!`,
        });
      },
      onError: (err: Error) => {
        toast({
          title: "Registration failed",
          description: err.message,
          variant: "destructive",
        });
      },
    }
  );

  const logoutMutation = useToastMutation<void, Error, void>(
    async () => {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
    {
      onSuccess: () => {
        setUser(null);
        setError(null);
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
      },
      onError: (err: Error) => {
        toast({
          title: "Logout failed",
          description: err.message,
          variant: "destructive",
        });
      },
    }
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

import { useMutation } from "@tanstack/react-query";

function useToastMutation<TData, TError, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData) => void;
    onError?: (error: TError) => void;
  }
): UseMutationResult<TData, TError, TVariables> {
  return useMutation<TData, TError, TVariables>({ mutationFn, ...options });
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
