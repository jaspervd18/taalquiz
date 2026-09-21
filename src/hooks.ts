import { useEffect, useState } from "react";
import { getProgress, subscribe, type Progress } from "./lib/storage";

export function useProgress(): Progress {
  const [state, setState] = useState<Progress>(getProgress);
  useEffect(() => subscribe(setState), []);
  return state;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export const useReducedMotion = () =>
  useMediaQuery("(prefers-reduced-motion: reduce)");
