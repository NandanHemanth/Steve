/**
 * Centralized profile hook.
 * - Loads from localStorage on mount.
 * - Auto-saves every field change immediately.
 * - Dispatches a "steve:profile-updated" CustomEvent so all tabs/components
 *   that call useProfile() pick up changes in real time.
 */
import { useCallback, useEffect, useState } from "react";
import { loadJson, saveJson, storageKeys } from "./storage";
import type { StudentProfile } from "./types";
import {
  DEFAULT_STUDENT_PROFILE,
  finalizeStudentProfile,
  migrateStudentProfile
} from "./studentProfile";

const EVENT = "steve:profile-updated";

function readProfile(): StudentProfile {
  const raw = loadJson<StudentProfile | null>(storageKeys.profile, null);
  return migrateStudentProfile(raw) ?? { ...DEFAULT_STUDENT_PROFILE };
}

function persistProfile(p: StudentProfile): StudentProfile {
  const finalized = finalizeStudentProfile(p);
  saveJson(storageKeys.profile, finalized);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: finalized }));
  return finalized;
}

type UseProfileReturn = {
  profile: StudentProfile;
  /** Replace a subset of profile fields and auto-save. */
  updateProfile: (patch: Partial<StudentProfile>) => void;
  /** Force a full profile replacement and auto-save. */
  setProfile: (p: StudentProfile) => void;
  /** Re-read from localStorage (useful after external write). */
  refreshProfile: () => void;
};

export function useProfile(): UseProfileReturn {
  const [profile, setProfileState] = useState<StudentProfile>(readProfile);

  // Listen for cross-component updates
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<StudentProfile>).detail;
      if (detail) setProfileState(detail);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const updateProfile = useCallback((patch: Partial<StudentProfile>) => {
    setProfileState((prev) => {
      const next = persistProfile({ ...prev, ...patch });
      return next;
    });
  }, []);

  const setProfile = useCallback((p: StudentProfile) => {
    const next = persistProfile(p);
    setProfileState(next);
  }, []);

  const refreshProfile = useCallback(() => {
    setProfileState(readProfile());
  }, []);

  return { profile, updateProfile, setProfile, refreshProfile };
}
