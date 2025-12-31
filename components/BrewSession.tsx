"use client";

import { useState, useEffect, useRef } from "react";
import { Recipe } from "@/components/RecipeCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, RotateCcw, Check, Flame, ThermometerSnowflake, Beaker, Snowflake, Activity, Droplets, ToggleLeft, AlarmClock, CheckCircle2, Settings } from "lucide-react";
import { toast } from "sonner";

interface BrewSessionProps {
  recipe: Recipe & { id?: string; units?: "metric" | "imperial" };
  onFinish?: () => void;
}

interface TimerState {
  targetEndTime: number | null;
  status: 'running' | 'paused' | 'idle';
  pausedTimeLeft?: number;
}

interface SessionData {
  mashTimer?: TimerState;
  boilTimer?: TimerState;
  currentMashStep?: number;
  activeTab?: string;
  chillChecklist?: boolean[];
  measuredOG?: string;
  measuredSG?: string;
  measuredPlato?: string;
  measuredBrix?: string;
  measuredVolume?: string;
  yeastPitched?: boolean;
  whirlpoolTimer?: TimerState;
  showSG?: boolean;
  showPlato?: boolean;
  showBrix?: boolean;
  automatedMash?: boolean;
  hopAdditions?: Set<string>;
}

export function BrewSession({ recipe, onFinish }: BrewSessionProps) {
  const recipeId = recipe.id || recipe.name || 'default';
  const storageKey = `brew-session-${recipeId}`;
  
  // Detect unit system from recipe (check if amounts contain "kg" vs "lb")
  const detectUnitSystem = (): "metric" | "imperial" => {
    const firstMalt = recipe.malts?.[0]?.amount || "";
    if (firstMalt.toLowerCase().includes("kg") || firstMalt.toLowerCase().includes("g") || firstMalt.toLowerCase().includes("l")) {
      return "metric";
    }
    return recipe.units || "metric";
  };
  
  const unitSystem = detectUnitSystem();
  
  // Initialize activeTab from localStorage if available
  const getInitialTab = (): string => {
    try {
      const data = localStorage.getItem(storageKey);
      if (data) {
        const parsed: SessionData = JSON.parse(data);
        if (parsed.activeTab) return parsed.activeTab;
      }
    } catch (e) {
      console.error("Error loading initial tab:", e);
    }
    return "prep";
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  // --- STATES FÜR PREP ---
  // Calculate total items: 2 general (clean, water) + malts + extras
  const allExtras = recipe.extras || [];
  const waterAgents = allExtras.filter((e: any) => e.type === "water_agent");
  const nonWaterExtras = allExtras.filter((e: any) => e.type !== "water_agent");
  const totalPrepItems = 2 + (recipe.malts?.length || 0) + nonWaterExtras.length;
  
  const [prepChecked, setPrepChecked] = useState<boolean[]>(
    new Array(totalPrepItems).fill(false)
  );
  const [showSG, setShowSG] = useState(true);
  const [showPlato, setShowPlato] = useState(false);
  const [showBrix, setShowBrix] = useState(false);
  const [automatedMash, setAutomatedMash] = useState(false);

  // --- STATES FÜR MASH ---
  const [currentMashStep, setCurrentMashStep] = useState(0);
  const [mashTimeLeft, setMashTimeLeft] = useState(0);
  const [isHeatingMash, setIsHeatingMash] = useState(true);
  const [mashTimerState, setMashTimerState] = useState<TimerState>({ targetEndTime: null, status: 'idle' });
  const [mashStepsCompleted, setMashStepsCompleted] = useState<Set<number>>(new Set());

  // --- STATES FÜR BOIL ---
  const [boilTimeLeft, setBoilTimeLeft] = useState(60 * 60);
  const [isHeatingBoil, setIsHeatingBoil] = useState(true);
  const [boilTimerState, setBoilTimerState] = useState<TimerState>({ targetEndTime: null, status: 'idle' });
  const [hopAdditions, setHopAdditions] = useState<Set<string>>(new Set());

  // --- STATES FÜR CHILL & FERMENT ---
  const [chillChecklist, setChillChecklist] = useState<boolean[]>([false, false, false, false]);
  const [measuredOG, setMeasuredOG] = useState("");
  const [measuredSG, setMeasuredSG] = useState("");
  const [measuredPlato, setMeasuredPlato] = useState("");
  const [measuredBrix, setMeasuredBrix] = useState("");
  const [measuredVolume, setMeasuredVolume] = useState("");
  const [yeastPitched, setYeastPitched] = useState(false);
  const [whirlpoolTimerState, setWhirlpoolTimerState] = useState<TimerState>({ targetEndTime: null, status: 'idle' });
  const [whirlpoolTimeLeft, setWhirlpoolTimeLeft] = useState(0);
  const [whirlpoolActive, setWhirlpoolActive] = useState(false);

  const mashInterval = useRef<NodeJS.Timeout | null>(null);
  const boilInterval = useRef<NodeJS.Timeout | null>(null);
  const whirlpoolInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hopAlarmTriggered = useRef<Set<string>>(new Set());
  const wakeLockRef = useRef<any>(null); // WakeLockSentinel type from browser API

  // --- WAKE LOCK HOOK ---
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock activated');
      }
    } catch (err: any) {
      // Wake Lock may fail due to user permissions or lack of support
      console.warn('Wake Lock not available:', err.message);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake Lock released');
      }
    } catch (err) {
      console.warn('Error releasing Wake Lock:', err);
    }
  };

  // Auto-request/release Wake Lock based on timer status
  useEffect(() => {
    const isAnyTimerRunning = 
      (mashTimerState.status === 'running') || 
      (boilTimerState.status === 'running') || 
      (whirlpoolTimerState.status === 'running');
    
    if (isAnyTimerRunning) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Cleanup on unmount
    return () => {
      releaseWakeLock();
    };
  }, [mashTimerState.status, boilTimerState.status, whirlpoolTimerState.status]);

  // --- CHECK FOR WHIRLPOOL HOPS ---
  const hasWhirlpoolHops = (recipe.hops || []).some((hop: any) => 
    hop.time?.toLowerCase().includes('whirlpool') || 
    hop.time?.toLowerCase().includes('flameout') ||
    (hop.temp && parseFloat(hop.temp) >= 75 && parseFloat(hop.temp) <= 85)
  );

  // --- INIT AUDIO ---
  useEffect(() => {
    audioRef.current = new Audio("/alarm.mp3"); 
  }, []);

  // --- HELPER: Sound ---
  const playAlarm = () => {
    if (audioRef.current) {
      audioRef.current.play().catch((e) => console.log("Audio play failed:", e));
    }
  };

  // --- HELPER: Zeit Formatieren (MM:SS) ---
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // --- HELPER: Parse "60 min" zu Sekunden ---
  const parseDuration = (timeStr: string): number => {
    const match = timeStr.match(/(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10) * 60;
    }
    return 0;
  };

  // --- HELPER: Convert Gravity Units to SG ---
  const getSgValue = (val: number, unit: "SG" | "Plato" | "Brix"): number => {
    if (unit === "SG") return val;
    // Simple conversion: Plato/Brix * 0.004 + 1
    // Formula: SG = 1 + (Plato / 250)
    return 1 + (val / 250);
  };

  // --- LOCALSTORAGE HELPERS ---
  const saveSessionData = (data: Partial<SessionData>) => {
    try {
      const existing = localStorage.getItem(storageKey);
      const current: SessionData = existing ? JSON.parse(existing) : {};
      const updated = { ...current, ...data };
      // Convert Sets to Arrays for JSON serialization
      if (updated.hopAdditions) {
        updated.hopAdditions = updated.hopAdditions as any;
      }
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving session data:", e);
    }
  };

  const loadSessionData = (): SessionData | null => {
    try {
      const data = localStorage.getItem(storageKey);
      if (!data) return null;
      const parsed: SessionData = JSON.parse(data);
      // Convert arrays back to Sets
      if (parsed.hopAdditions && Array.isArray(parsed.hopAdditions)) {
        parsed.hopAdditions = new Set(parsed.hopAdditions) as any;
      }
      return parsed;
    } catch (e) {
      console.error("Error loading session data:", e);
      return null;
    }
  };

  const clearSessionData = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error("Error clearing session data:", e);
    }
  };

  // --- TIMESTAMP-BASED TIMER LOGIC ---
  const updateTimerFromTimestamp = (timerState: TimerState, setTimeLeft: (val: number) => void): number => {
    if (!timerState.targetEndTime) return 0;
    
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((timerState.targetEndTime - now) / 1000));
    
    if (remaining === 0 && timerState.status === 'running') {
      setTimeLeft(0);
      return 0;
    }
    
    setTimeLeft(remaining);
    return remaining;
  };

  // --- LOAD SESSION ON MOUNT ---
  useEffect(() => {
    const saved = loadSessionData();
    if (saved) {
      // Restore active tab
      if (saved.activeTab) setActiveTab(saved.activeTab);
      
      // Restore settings
      if (saved.showSG !== undefined) setShowSG(saved.showSG);
      if (saved.showPlato !== undefined) setShowPlato(saved.showPlato);
      if (saved.showBrix !== undefined) setShowBrix(saved.showBrix);
      if (saved.automatedMash !== undefined) setAutomatedMash(saved.automatedMash);
      
      // Restore mash step
      if (saved.currentMashStep !== undefined) setCurrentMashStep(saved.currentMashStep);
      
      // Restore mash timer
      if (saved.mashTimer) {
        setMashTimerState(saved.mashTimer);
        if (saved.mashTimer.status === 'running' && saved.mashTimer.targetEndTime) {
          const remaining = updateTimerFromTimestamp(saved.mashTimer, setMashTimeLeft);
          if (remaining > 0) {
            setIsHeatingMash(false);
          } else {
            setMashTimerState({ targetEndTime: null, status: 'idle' });
          }
        } else if (saved.mashTimer.status === 'paused' && saved.mashTimer.pausedTimeLeft) {
          setMashTimeLeft(saved.mashTimer.pausedTimeLeft);
          setIsHeatingMash(false);
        }
      }
      
      // Restore boil timer
      if (saved.boilTimer) {
        setBoilTimerState(saved.boilTimer);
        if (saved.boilTimer.status === 'running' && saved.boilTimer.targetEndTime) {
          const remaining = updateTimerFromTimestamp(saved.boilTimer, setBoilTimeLeft);
          if (remaining > 0) {
            setIsHeatingBoil(false);
          } else {
            setBoilTimerState({ targetEndTime: null, status: 'idle' });
            setActiveTab("chill");
          }
        } else if (saved.boilTimer.status === 'paused' && saved.boilTimer.pausedTimeLeft) {
          setBoilTimeLeft(saved.boilTimer.pausedTimeLeft);
          setIsHeatingBoil(false);
        }
      }
      
      // Restore chill checklist
      if (saved.chillChecklist) setChillChecklist(saved.chillChecklist);
      if (saved.measuredOG) setMeasuredOG(saved.measuredOG);
      if (saved.measuredSG) setMeasuredSG(saved.measuredSG);
      if (saved.measuredPlato) setMeasuredPlato(saved.measuredPlato);
      if (saved.measuredBrix) setMeasuredBrix(saved.measuredBrix);
      if (saved.measuredVolume) setMeasuredVolume(saved.measuredVolume);
      if (saved.yeastPitched) setYeastPitched(saved.yeastPitched);
      if (saved.hopAdditions) setHopAdditions(saved.hopAdditions as Set<string>);
      
      // Restore whirlpool timer
      if (saved.whirlpoolTimer) {
        setWhirlpoolTimerState(saved.whirlpoolTimer);
        if (saved.whirlpoolTimer.status === 'running' && saved.whirlpoolTimer.targetEndTime) {
          const remaining = updateTimerFromTimestamp(saved.whirlpoolTimer, setWhirlpoolTimeLeft);
          if (remaining > 0) {
            setWhirlpoolActive(true);
          }
        }
      }
    } else {
      // Initialize boil time from hops
      let maxBoilTime = 60;
      (recipe.hops || []).forEach((hop: any) => {
        if (hop.boil_time && hop.boil_time > maxBoilTime) maxBoilTime = hop.boil_time;
      });
      setBoilTimeLeft(maxBoilTime * 60);
    }
  }, []);

  // --- SAVE SETTINGS ---
  useEffect(() => {
    saveSessionData({ showSG, showPlato, showBrix, automatedMash });
  }, [showSG, showPlato, showBrix, automatedMash]);

  // --- SAVE MASH STEP ---
  useEffect(() => {
    saveSessionData({ currentMashStep });
  }, [currentMashStep]);

  // ================= LOGIK: PREP =================
  const toggleAllPrep = () => {
    const areAllChecked = prepChecked.every(Boolean);
    setPrepChecked(prepChecked.map(() => !areAllChecked));
  };

  const handlePrepCheck = (index: number) => {
    const newChecked = [...prepChecked];
    newChecked[index] = !newChecked[index];
    setPrepChecked(newChecked);
  };

  // ================= LOGIK: MASH TIMER (TIMESTAMP-BASED) =================
  const initializeMashStep = (stepIndex: number) => {
    if (!recipe.mash_schedule || stepIndex >= recipe.mash_schedule.length) return;
    const step = recipe.mash_schedule[stepIndex];
    const duration = parseDuration(step.time);
    setMashTimeLeft(duration);
    setIsHeatingMash(true);
    setMashTimerState({ targetEndTime: null, status: 'idle' });
    saveSessionData({ mashTimer: { targetEndTime: null, status: 'idle' } });
  };

  useEffect(() => {
    if (recipe.mash_schedule && currentMashStep < recipe.mash_schedule.length) {
      const saved = loadSessionData();
      if (!saved?.mashTimer || saved.mashTimer.status === 'idle') {
        initializeMashStep(currentMashStep);
      }
    }
  }, [currentMashStep, recipe.mash_schedule]);

  // Mash timer update loop
  useEffect(() => {
    if (mashTimerState.status === 'running' && mashTimerState.targetEndTime) {
      mashInterval.current = setInterval(() => {
        const remaining = updateTimerFromTimestamp(mashTimerState, setMashTimeLeft);
        if (remaining === 0) {
          setMashTimerState({ targetEndTime: null, status: 'idle' });
          setIsHeatingMash(false);
          playAlarm();
          toast.success("Mash step complete!");
          if (mashInterval.current) clearInterval(mashInterval.current);
        }
      }, 1000);
    }
    return () => {
      if (mashInterval.current) clearInterval(mashInterval.current);
    };
  }, [mashTimerState.status, mashTimerState.targetEndTime]);

  const toggleMashTimer = () => {
    if (isHeatingMash) {
      setIsHeatingMash(false);
      const duration = parseDuration(recipe.mash_schedule?.[currentMashStep]?.time || "60 min");
      const targetEndTime = Date.now() + (duration * 1000);
      const newState: TimerState = { targetEndTime, status: 'running' };
      setMashTimerState(newState);
      setMashTimeLeft(duration);
      saveSessionData({ mashTimer: newState });
    } else if (mashTimerState.status === 'running') {
      // Pause
      const newState: TimerState = { 
        targetEndTime: mashTimerState.targetEndTime, 
        status: 'paused',
        pausedTimeLeft: mashTimeLeft
      };
      setMashTimerState(newState);
      saveSessionData({ mashTimer: newState });
    } else if (mashTimerState.status === 'paused') {
      // Resume
      const remaining = mashTimerState.pausedTimeLeft || mashTimeLeft;
      const targetEndTime = Date.now() + (remaining * 1000);
      const newState: TimerState = { targetEndTime, status: 'running' };
      setMashTimerState(newState);
      saveSessionData({ mashTimer: newState });
    }
  };
  
  const resetMashTimer = () => {
    if (mashInterval.current) clearInterval(mashInterval.current);
    initializeMashStep(currentMashStep);
    const saved = loadSessionData();
    if (saved) {
      saveSessionData({ ...saved, mashTimer: { targetEndTime: null, status: 'idle' } });
    }
  };

  const nextMashStep = () => {
    if (mashInterval.current) clearInterval(mashInterval.current);
    setMashTimerState({ targetEndTime: null, status: 'idle' });
    saveSessionData({ mashTimer: { targetEndTime: null, status: 'idle' } });
    
    if (recipe.mash_schedule && currentMashStep < recipe.mash_schedule.length - 1) {
      setCurrentMashStep(currentMashStep + 1);
    } else {
      toast.success("Mash complete! Time to sparge.");
      setActiveTab("boil");
    }
  };

  const toggleMashStepCompleted = (stepIndex: number) => {
    const newCompleted = new Set(mashStepsCompleted);
    if (newCompleted.has(stepIndex)) {
      newCompleted.delete(stepIndex);
    } else {
      newCompleted.add(stepIndex);
    }
    setMashStepsCompleted(newCompleted);
  };

  // ================= LOGIK: BOIL TIMER (TIMESTAMP-BASED) =================
  useEffect(() => {
    if (boilTimerState.status === 'running' && boilTimerState.targetEndTime) {
      boilInterval.current = setInterval(() => {
        const remaining = updateTimerFromTimestamp(boilTimerState, setBoilTimeLeft);
        
        // Check for hop additions
        const allHops = (recipe.hops || []).filter((h: any) => h.boil_time && h.boil_time > 0);
        const timeRemainingMinutes = Math.ceil(remaining / 60);
        
        allHops.forEach((hop: any) => {
          const hopKey = `${hop.name}-${hop.boil_time}`;
          if (timeRemainingMinutes === hop.boil_time && !hopAlarmTriggered.current.has(hopKey)) {
            hopAlarmTriggered.current.add(hopKey);
            playAlarm();
            toast.warning(`Hop Addition: ${hop.name} ${hop.amount}`, {
              duration: 10000,
              description: `Add now at ${hop.boil_time} minutes remaining!`
            });
          }
        });
        
        if (remaining === 0) {
          setBoilTimerState({ targetEndTime: null, status: 'idle' });
          setIsHeatingBoil(false);
          playAlarm();
          toast.success("Boil complete! Flame out.");
          setActiveTab("chill");
          if (boilInterval.current) clearInterval(boilInterval.current);
        }
      }, 1000);
    }
    return () => {
      if (boilInterval.current) clearInterval(boilInterval.current);
    };
  }, [boilTimerState.status, boilTimerState.targetEndTime]);

  const toggleBoilTimer = () => {
    if (isHeatingBoil) {
      setIsHeatingBoil(false);
      let maxBoilTime = 60;
      (recipe.hops || []).forEach((hop: any) => {
        if (hop.boil_time && hop.boil_time > maxBoilTime) maxBoilTime = hop.boil_time;
      });
      const duration = maxBoilTime * 60;
      const targetEndTime = Date.now() + (duration * 1000);
      const newState: TimerState = { targetEndTime, status: 'running' };
      setBoilTimerState(newState);
      setBoilTimeLeft(duration);
      hopAlarmTriggered.current.clear(); // Reset alarms
      saveSessionData({ boilTimer: newState });
    } else if (boilTimerState.status === 'running') {
      // Pause
      const newState: TimerState = { 
        targetEndTime: boilTimerState.targetEndTime, 
        status: 'paused',
        pausedTimeLeft: boilTimeLeft
      };
      setBoilTimerState(newState);
      saveSessionData({ boilTimer: newState });
    } else if (boilTimerState.status === 'paused') {
      // Resume
      const remaining = boilTimerState.pausedTimeLeft || boilTimeLeft;
      const targetEndTime = Date.now() + (remaining * 1000);
      const newState: TimerState = { targetEndTime, status: 'running' };
      setBoilTimerState(newState);
      saveSessionData({ boilTimer: newState });
    }
  };

  const resetBoilTimer = () => {
    if (boilInterval.current) clearInterval(boilInterval.current);
    let maxBoilTime = 60;
    (recipe.hops || []).forEach((hop: any) => {
      if (hop.boil_time && hop.boil_time > maxBoilTime) maxBoilTime = hop.boil_time;
    });
    setBoilTimeLeft(maxBoilTime * 60);
    setIsHeatingBoil(true);
    setBoilTimerState({ targetEndTime: null, status: 'idle' });
    hopAlarmTriggered.current.clear();
    saveSessionData({ boilTimer: { targetEndTime: null, status: 'idle' } });
  };

  const finishBoil = () => {
    if (boilInterval.current) clearInterval(boilInterval.current);
    setBoilTimerState({ targetEndTime: null, status: 'idle' });
    saveSessionData({ boilTimer: { targetEndTime: null, status: 'idle' } });
    toast.success("Boil finished manually.");
    setActiveTab("chill");
  };

  const markHopAdded = (hopName: string, boilTime: number) => {
    const hopKey = `${hopName}-${boilTime}`;
    const newSet = new Set(hopAdditions);
    newSet.add(hopKey);
    setHopAdditions(newSet);
    saveSessionData({ hopAdditions: Array.from(newSet) as any });
    toast.success(`${hopName} added at ${boilTime} min`);
  };

  // Get sorted hops for display
  const getSortedHops = () => {
    return (recipe.hops || [])
      .filter((h: any) => h.boil_time && h.boil_time > 0)
      .sort((a: any, b: any) => (b.boil_time || 0) - (a.boil_time || 0));
  };

  const getHopStatus = (hop: any): { status: 'future' | 'now' | 'past'; timeRemaining: number } => {
    if (boilTimerState.status !== 'running' && !isHeatingBoil) {
      return { status: 'future', timeRemaining: hop.boil_time || 0 };
    }
    const timeRemainingMinutes = Math.ceil(boilTimeLeft / 60);
    const hopTime = hop.boil_time || 0;
    const hopKey = `${hop.name}-${hopTime}`;
    
    if (hopAdditions.has(hopKey)) {
      return { status: 'past', timeRemaining: 0 };
    }
    if (timeRemainingMinutes === hopTime) {
      return { status: 'now', timeRemaining: hopTime };
    }
    if (timeRemainingMinutes < hopTime) {
      return { status: 'past', timeRemaining: hopTime - timeRemainingMinutes };
    }
    return { status: 'future', timeRemaining: timeRemainingMinutes - hopTime };
  };

  // ================= LOGIK: WHIRLPOOL TIMER =================
  const startWhirlpoolTimer = (durationSeconds: number = 20 * 60) => {
    const targetEndTime = Date.now() + (durationSeconds * 1000);
    const newState: TimerState = { targetEndTime, status: 'running' };
    setWhirlpoolTimerState(newState);
    setWhirlpoolTimeLeft(durationSeconds);
    setWhirlpoolActive(true);
    saveSessionData({ whirlpoolTimer: newState });
  };

  useEffect(() => {
    if (whirlpoolTimerState.status === 'running' && whirlpoolTimerState.targetEndTime) {
      whirlpoolInterval.current = setInterval(() => {
        const remaining = updateTimerFromTimestamp(whirlpoolTimerState, setWhirlpoolTimeLeft);
        if (remaining === 0) {
          setWhirlpoolTimerState({ targetEndTime: null, status: 'idle' });
          setWhirlpoolActive(false);
          playAlarm();
          if (whirlpoolInterval.current) clearInterval(whirlpoolInterval.current);
        }
      }, 1000);
    }
    return () => {
      if (whirlpoolInterval.current) clearInterval(whirlpoolInterval.current);
    };
  }, [whirlpoolTimerState.status, whirlpoolTimerState.targetEndTime]);

  // ================= LOGIK: EFFICIENCY CALCULATION =================
  const calculateEfficiency = (): { efficiency: number; status: 'good' | 'ok' | 'poor' } | null => {
    // Priority: SG > Plato > Brix
    let ogValue: number | null = null;
    let unit: "SG" | "Plato" | "Brix" = "SG";
    
    if (measuredSG) {
      ogValue = parseFloat(measuredSG.replace(/[^\d.]/g, ""));
      unit = "SG";
    } else if (measuredPlato) {
      ogValue = parseFloat(measuredPlato.replace(/[^\d.]/g, ""));
      unit = "Plato";
    } else if (measuredBrix) {
      ogValue = parseFloat(measuredBrix.replace(/[^\d.]/g, ""));
      unit = "Brix";
    }
    
    if (!ogValue || ogValue <= 0 || !measuredVolume) return null;
    
    // Convert to SG if needed
    const og = getSgValue(ogValue, unit);
    if (og < 1) return null;
    
    const volumeL = parseFloat(measuredVolume);
    if (isNaN(volumeL) || volumeL <= 0) return null;
    
    // Calculate total grain weight in kg
    let totalGrainKg = 0;
    (recipe.malts || []).forEach((malt: any) => {
      const amountStr = malt.amount || "";
      const kgMatch = amountStr.match(/([\d.]+)\s*kg/i);
      const gMatch = amountStr.match(/([\d.]+)\s*g/i);
      if (kgMatch) {
        totalGrainKg += parseFloat(kgMatch[1]);
      } else if (gMatch) {
        totalGrainKg += parseFloat(gMatch[1]) / 1000;
      } else if (malt.amount_grams) {
        totalGrainKg += malt.amount_grams / 1000;
      }
    });
    
    if (totalGrainKg === 0) return null;
    
    // Simplified efficiency calculation
    const potentialPoints = 300; // points per kg
    const totalPotential = totalGrainKg * potentialPoints;
    const actualPoints = volumeL * (og - 1) * 1000;
    const efficiency = (actualPoints / totalPotential) * 100;
    
    let status: 'good' | 'ok' | 'poor' = 'ok';
    if (efficiency >= 70) status = 'good';
    else if (efficiency < 60) status = 'poor';
    
    return { efficiency, status };
  };

  const efficiencyResult = calculateEfficiency();

  // ================= SAVE CHILL DATA =================
  useEffect(() => {
    saveSessionData({ 
      chillChecklist, 
      measuredSG, 
      measuredPlato, 
      measuredBrix, 
      measuredVolume, 
      yeastPitched,
      hopAdditions: Array.from(hopAdditions) as any
    });
  }, [chillChecklist, measuredSG, measuredPlato, measuredBrix, measuredVolume, yeastPitched, hopAdditions]);

  // ================= RENDER =================
  return (
    <div className="max-w-4xl mx-auto pb-20">
      <Tabs 
        value={activeTab} 
        onValueChange={(value) => {
          setActiveTab(value);
          saveSessionData({ activeTab: value });
        }} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="prep">1. Prep & Weigh</TabsTrigger>
          <TabsTrigger value="mash">2. Mashing</TabsTrigger>
          <TabsTrigger value="boil">3. Boil & Hops</TabsTrigger>
          <TabsTrigger value="chill">4. Chill & Ferment</TabsTrigger>
        </TabsList>

        <TabsContent value="prep">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mise en Place</CardTitle>
               <Button variant="ghost" size="sm" onClick={toggleAllPrep}>
                 {prepChecked.every(Boolean) ? "Uncheck All" : "Check All"}
               </Button>
            </CardHeader>
            <CardContent>
              {/* Session Setup */}
              <div className="mb-8 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-[#FFBF00]" />
                  <h3 className="text-lg font-semibold text-[#FFBF00]">Session Setup</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Unit System</Label>
                    <p className="text-lg font-medium">{unitSystem === "metric" ? "Metric (kg, L, °C)" : "Imperial (lb, gal, °F)"}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Measurement Units</Label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="show-sg" 
                          checked={showSG}
                          onCheckedChange={(checked) => setShowSG(!!checked)}
                          className="data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black"
                        />
                        <Label htmlFor="show-sg" className="cursor-pointer">Show SG</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="show-plato" 
                          checked={showPlato}
                          onCheckedChange={(checked) => setShowPlato(!!checked)}
                          className="data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black"
                        />
                        <Label htmlFor="show-plato" className="cursor-pointer">Show Plato</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="show-brix" 
                          checked={showBrix}
                          onCheckedChange={(checked) => setShowBrix(!!checked)}
                          className="data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black"
                        />
                        <Label htmlFor="show-brix" className="cursor-pointer">Show Brix</Label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Select which gravity units you want to document</p>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                    <div>
                      <Label htmlFor="automated-mash" className="text-base cursor-pointer">Automated Mash Program?</Label>
                      <p className="text-xs text-muted-foreground">I programmed the mash steps into my brewing system</p>
                    </div>
                    <Switch
                      id="automated-mash"
                      checked={automatedMash}
                      onCheckedChange={setAutomatedMash}
                      className="data-[state=checked]:bg-[#FFBF00]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-[#FFBF00]">General</h3>
                   <div className="flex items-center space-x-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <Checkbox id="prep-clean" className="h-6 w-6 data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black" checked={prepChecked[0]} onCheckedChange={() => handlePrepCheck(0)} />
                    <Label htmlFor="prep-clean" className="text-lg cursor-pointer flex-1">Clean & Sanitize equipment</Label>
                  </div>
                   <div className="flex items-center space-x-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <Checkbox id="prep-water" className="h-6 w-6 data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black" checked={prepChecked[1]} onCheckedChange={() => handlePrepCheck(1)} />
                    <Label htmlFor="prep-water" className="text-lg cursor-pointer flex-1">Prepare Mash Water ({recipe.specs?.mash_water})</Label>
                  </div>
                  
                  {/* Water Agents (Water Chemistry) */}
                  {waterAgents.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <Label className="text-xs font-bold uppercase text-blue-400 mb-2 block">Water Adjustments</Label>
                      {waterAgents.map((agent: any, i: number) => (
                        <div key={i} className="flex items-center space-x-2 mt-1.5 text-sm">
                          <span className="font-medium text-blue-300">{agent.amount} {agent.unit || "g"}</span>
                          <span className="text-muted-foreground">{agent.name}</span>
                          {agent.description && (
                            <span className="text-xs text-muted-foreground">({agent.description})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-[#FFBF00]">Weigh Ingredients</h3>
                  {(recipe.malts || []).map((malt, i) => (
                    <div key={i} className="flex items-center space-x-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                      <Checkbox id={`malt-${i}`} className="h-6 w-6 data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black" checked={prepChecked[i + 2]} onCheckedChange={() => handlePrepCheck(i + 2)} />
                      <Label htmlFor={`malt-${i}`} className="text-lg cursor-pointer flex-1">
                        <span className="font-bold">{malt.amount}</span> {malt.name}
                      </Label>
                    </div>
                  ))}
                   {/* Non-Water Extras (Process Aids, etc.) */}
                   {nonWaterExtras.map((extra: any, i: number) => {
                     const indexOffset = (recipe.malts?.length || 0) + 2;
                     return (
                       <div key={i} className="flex items-center space-x-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                         <Checkbox 
                           id={`extra-${i}`} 
                           className="h-6 w-6 data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black" 
                           checked={prepChecked[indexOffset + i]} 
                           onCheckedChange={() => handlePrepCheck(indexOffset + i)} 
                         />
                         <Label htmlFor={`extra-${i}`} className="text-lg cursor-pointer flex-1">
                           <span className="font-bold">{extra.amount} {extra.unit || "g"}</span> {extra.name}
                           {extra.use && <span className="text-sm text-muted-foreground ml-1">({extra.use})</span>}
                         </Label>
                       </div>
                     );
                   })}
                </div>

                <Button className="w-full mt-8 bg-[#FFBF00] text-black hover:bg-[#E5AC00]" onClick={() => setActiveTab("mash")}>
                  Start Mashing
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mash">
          <Card>
            <CardHeader>
              <CardTitle>Mash Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {recipe.mash_schedule && recipe.mash_schedule.length > 0 ? (
                automatedMash ? (
                  // Automated Mode: Static Schedule Overview
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-400">
                        <ToggleLeft className="inline h-4 w-4 mr-2" />
                        Automated mode: Your system handles the mash program. Use this as a checklist.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {recipe.mash_schedule.map((step, i) => (
                        <div 
                          key={i} 
                          className={`flex items-center space-x-4 p-4 rounded-lg border ${
                            mashStepsCompleted.has(i) 
                              ? "bg-green-500/10 border-green-500/30" 
                              : "bg-zinc-900/50 border-zinc-800"
                          }`}
                        >
                          <Checkbox
                            checked={mashStepsCompleted.has(i)}
                            onCheckedChange={() => toggleMashStepCompleted(i)}
                            className="h-6 w-6 data-[state=checked]:bg-green-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-1">
                              <span className="font-semibold text-lg">{step.step}</span>
                              <span className="text-sm text-muted-foreground flex items-center">
                                <ThermometerSnowflake className="h-4 w-4 mr-1" />
                                {step.temp}
                              </span>
                              <span className="text-sm text-muted-foreground flex items-center">
                                <Beaker className="h-4 w-4 mr-1" />
                                {step.time}
                              </span>
                            </div>
                            {step.description && (
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                            )}
                          </div>
                          {mashStepsCompleted.has(i) && (
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                          )}
                        </div>
                      ))}
                    </div>
                    <Button 
                      className="w-full mt-6 bg-[#4CBB17] text-white hover:bg-[#4CBB17]/90 text-lg py-6"
                      onClick={() => {
                        toast.success("Mash complete! Starting boil.");
                        setActiveTab("boil");
                      }}
                    >
                      Mash Complete - Start Boil
                    </Button>
                  </div>
                ) : (
                  // Manual Mode: Timer-based
                  <div className="text-center py-8">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-[#FFBF00] mb-2">
                        Step {currentMashStep + 1}: {recipe.mash_schedule[currentMashStep].step}
                      </h2>
                     <div className="flex items-center justify-center gap-4 text-xl text-muted-foreground">
                        <div className="flex items-center"><ThermometerSnowflake className="mr-2 h-5 w-5"/> {recipe.mash_schedule[currentMashStep].temp}</div>
                        <div className="flex items-center"><Beaker className="mr-2 h-5 w-5"/> {recipe.mash_schedule[currentMashStep].time}</div>
                     </div>
                    <p className="text-muted-foreground mt-4">{recipe.mash_schedule[currentMashStep].description}</p>
                  </div>

                  {isHeatingMash ? (
                       <div className="mb-8 p-6 bg-orange-500/10 border border-orange-500/30 rounded-xl animate-pulse">
                          <Flame className="h-12 w-12 text-orange-500 mx-auto mb-2"/>
                          <h3 className="text-2xl font-bold text-orange-400">Heating Up...</h3>
                          <p>Reach target temperature first.</p>
                       </div>
                  ) : (
                     <div className="text-7xl font-bold text-[#FFBF00] tabular-nums mb-8">
                        {formatTime(mashTimeLeft)}
                      </div>
                  )}
                 
                  <div className="flex items-center justify-center gap-6">
                     <Button variant="outline" size="icon" onClick={resetMashTimer} className="h-14 w-14 rounded-full border-zinc-700 hover:bg-zinc-800" title="Reset Step">
                      <RotateCcw className="h-6 w-6" />
                    </Button>

                    <Button
                      onClick={toggleMashTimer}
                      className={`h-24 w-24 rounded-full shadow-lg transition-all transform hover:scale-105 ${
                        isHeatingMash ? 'bg-orange-500 hover:bg-orange-400 text-white' :
                        mashTimerState.status === 'running' ? 'bg-[#FFBF00] hover:bg-[#E5AC00] text-black' : 'bg-green-600 hover:bg-green-500 text-white'
                      }`}
                    >
                      {isHeatingMash ? <Flame className="h-10 w-10" /> : mashTimerState.status === 'running' ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10 ml-1" />}
                    </Button>

                     <Button variant="outline" size="icon" onClick={nextMashStep} className="h-14 w-14 rounded-full border-zinc-700 hover:bg-green-900/30 hover:text-green-400 hover:border-green-800" title="Next Step / Finish">
                      <Check className="h-6 w-6" />
                    </Button>
                  </div>
                   <div className="mt-4 text-sm text-muted-foreground">
                       {isHeatingMash ? "Click center button when temp reached." : mashTimerState.status === 'running' ? "Timer running..." : "Timer paused."}
                   </div>

                  <div className="flex justify-center gap-2 mt-8">
                    {recipe.mash_schedule.map((_, i) => (
                      <div key={i} className={`h-3 w-3 rounded-full ${i === currentMashStep ? "bg-[#FFBF00]" : i < currentMashStep ? "bg-green-500" : "bg-zinc-700"}`} />
                    ))}
                  </div>
                </div>
              )) : (
                <p className="text-muted-foreground">No mash schedule available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="boil">
          <Card>
            <CardHeader>
              <CardTitle>Boil & Hop Schedule</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-center py-8">
                 <h2 className="text-2xl font-bold text-[#FFBF00] mb-4">Wort Boil</h2>

                   {isHeatingBoil ? (
                       <div className="mb-8 p-6 bg-red-500/10 border border-red-500/30 rounded-xl animate-pulse">
                          <Flame className="h-12 w-12 text-red-500 mx-auto mb-2"/>
                          <h3 className="text-2xl font-bold text-red-400">Heating to Boil...</h3>
                          <p>Wait for a rolling boil (100°C).</p>
                       </div>
                  ) : (
                    <div className="text-8xl font-bold text-[#FFBF00] tabular-nums mb-8">
                      {formatTime(boilTimeLeft)}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-6 mb-12">
                    <Button variant="outline" size="icon" onClick={resetBoilTimer} className="h-14 w-14 rounded-full border-zinc-700 hover:bg-zinc-800" title="Reset Boil Timer">
                      <RotateCcw className="h-6 w-6" />
                    </Button>

                    <Button
                      onClick={toggleBoilTimer}
                       className={`h-24 w-24 rounded-full shadow-lg transition-all transform hover:scale-105 ${
                        isHeatingBoil ? 'bg-red-600 hover:bg-red-500 text-white' :
                        boilTimerState.status === 'running' ? 'bg-[#FFBF00] hover:bg-[#E5AC00] text-black' : 'bg-green-600 hover:bg-green-500 text-white'
                      }`}
                    >
                       {isHeatingBoil ? <Flame className="h-10 w-10" /> : boilTimerState.status === 'running' ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10 ml-1" />}
                    </Button>

                    <Button variant="outline" size="icon" onClick={finishBoil} className="h-14 w-14 rounded-full border-zinc-700 hover:bg-green-900/30 hover:text-green-400 hover:border-green-800" title="Finish Boil Manually">
                      <Check className="h-6 w-6" />
                    </Button>
                  </div>

                <div className="text-left space-y-3 max-w-xl mx-auto">
                   <h3 className="font-semibold mb-4 flex items-center gap-2">
                     <AlarmClock className="h-5 w-5" />
                     Hop Additions (Chronological)
                   </h3>
                  {getSortedHops().map((hop: any, i: number) => {
                    const hopStatus = getHopStatus(hop);
                    const hopKey = `${hop.name}-${hop.boil_time}`;
                    const isAdded = hopAdditions.has(hopKey);
                    
                    return (
                    <div 
                      key={i} 
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        isAdded 
                          ? "bg-green-500/10 border-green-500/30" 
                          : hopStatus.status === 'now'
                          ? "bg-yellow-500/20 border-yellow-500 animate-pulse"
                          : hopStatus.status === 'past'
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-zinc-900/50 border-zinc-800"
                      }`}
                    >
                       <div className="flex items-center gap-4 flex-1">
                         <Checkbox 
                           id={`hop-${i}`} 
                           className="h-7 w-7 !border-2 !border-white/80 bg-white/10 data-[state=checked]:bg-green-500 data-[state=checked]:!border-green-500 data-[state=checked]:text-black data-[state=unchecked]:border-white/80" 
                           checked={isAdded}
                           onCheckedChange={(checked) => {
                             if (checked) {
                               markHopAdded(hop.name, hop.boil_time || 0);
                             } else {
                               // Allow unchecking to undo
                               const newSet = new Set(hopAdditions);
                               newSet.delete(hopKey);
                               setHopAdditions(newSet);
                               saveSessionData({ hopAdditions: Array.from(newSet) as any });
                             }
                           }}
                           disabled={hopStatus.status === 'future'}
                         />
                         <div className="flex-1">
                            <span className={`font-bold text-lg ${isAdded ? 'line-through text-muted-foreground' : ''}`}>
                              {hop.amount} {hop.name}
                            </span>
                            <p className={`text-sm ${isAdded ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                              Add at {hop.time}
                            </p>
                         </div>
                       </div>
                       <div className="flex items-center gap-3">
                         {hopStatus.status === 'now' && !isAdded && (
                           <AlarmClock className="h-5 w-5 text-yellow-500 animate-pulse" />
                         )}
                         {hopStatus.status === 'future' && (
                           <span className="text-sm text-muted-foreground">Add in {hopStatus.timeRemaining} min</span>
                         )}
                         {hopStatus.status === 'past' && !isAdded && (
                           <span className="text-sm text-red-400">Missed ({hopStatus.timeRemaining} min ago)</span>
                         )}
                         {isAdded && (
                           <CheckCircle2 className="h-5 w-5 text-green-500" />
                         )}
                         <span className={`font-mono font-bold min-w-[60px] text-right ${isAdded ? 'text-muted-foreground line-through' : 'text-[#FFBF00]'}`}>
                           @ {hop.boil_time} min
                         </span>
                       </div>
                    </div>
                    );
                  })}
                   {(recipe.extras || []).filter((e) => e.use === 'Boil').map((extra, i) => (
                     <div key={`extra-${i}`} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                       <div className="flex items-center gap-4">
                         <Checkbox id={`boil-extra-${i}`} className="h-6 w-6 data-[state=checked]:bg-green-500 data-[state=checked]:text-black" />
                         <div>
                            <span className="font-bold text-lg">{extra.amount} {extra.name}</span>
                            <p className="text-sm text-muted-foreground">{extra.use}</p>
                         </div>
                       </div>
                       <span className="font-mono font-bold text-[#FFBF00]">{extra.time}</span>
                    </div>
                   ))}
                </div>
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chill">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Snowflake className="h-6 w-6 text-blue-400" />
                Chill & Ferment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Whirlpool Section */}
              {hasWhirlpoolHops && (
                <div className="p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <h3 className="text-lg font-semibold text-[#FFBF00] mb-4 flex items-center gap-2">
                    <Droplets className="h-5 w-5" />
                    Whirlpool
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4 p-3 bg-zinc-800/50 rounded-lg">
                      <Checkbox 
                        id="cool-to-80" 
                        className="h-6 w-6 data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black"
                        checked={chillChecklist[0]}
                        onCheckedChange={(checked) => {
                          const newChecklist = [...chillChecklist];
                          newChecklist[0] = !!checked;
                          setChillChecklist(newChecklist);
                          if (checked && !whirlpoolActive) {
                            startWhirlpoolTimer(20 * 60); // 20 minutes
                          }
                        }}
                      />
                      <Label htmlFor="cool-to-80" className="text-lg cursor-pointer flex-1">
                        Cool to 80°C for Whirlpool
                      </Label>
                    </div>
                    {whirlpoolActive && (
                      <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="text-4xl font-bold text-blue-400 tabular-nums mb-2">
                          {formatTime(whirlpoolTimeLeft)}
                        </div>
                        <p className="text-sm text-muted-foreground">Whirlpool Timer</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cooling Checklist */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#FFBF00]">Cooling Checklist</h3>
                <div className="flex items-center space-x-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <Checkbox 
                    id="chill-connect" 
                    className="h-6 w-6 data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black"
                    checked={chillChecklist[1]}
                    onCheckedChange={(checked) => {
                      const newChecklist = [...chillChecklist];
                      newChecklist[1] = !!checked;
                      setChillChecklist(newChecklist);
                    }}
                  />
                  <Label htmlFor="chill-connect" className="text-lg cursor-pointer flex-1">
                    Connect Wort Chiller / Transfer to Cube
                  </Label>
                </div>
                <div className="flex items-center space-x-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <Checkbox 
                    id="chill-temp" 
                    className="h-6 w-6 data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black"
                    checked={chillChecklist[2]}
                    onCheckedChange={(checked) => {
                      const newChecklist = [...chillChecklist];
                      newChecklist[2] = !!checked;
                      setChillChecklist(newChecklist);
                    }}
                  />
                  <Label htmlFor="chill-temp" className="text-lg cursor-pointer flex-1">
                    Cool wort to Pitching Temp (e.g. 20°C)
                  </Label>
                </div>
              </div>

              {/* Measurements - Only show selected units */}
              <div className="p-6 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-4">
                <h3 className="text-lg font-semibold text-[#FFBF00]">Measurements</h3>
                
                {showSG && (
                  <div className="space-y-2">
                    <Label htmlFor="measured-sg">Measured Original Gravity - SG</Label>
                    <Input
                      id="measured-sg"
                      type="text"
                      placeholder="e.g. 1.054"
                      value={measuredSG}
                      onChange={(e) => setMeasuredSG(e.target.value)}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                )}
                
                {showPlato && (
                  <div className="space-y-2">
                    <Label htmlFor="measured-plato">Measured Original Gravity - Plato (°P)</Label>
                    <Input
                      id="measured-plato"
                      type="text"
                      placeholder="e.g. 13.5"
                      value={measuredPlato}
                      onChange={(e) => setMeasuredPlato(e.target.value)}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                )}
                
                {showBrix && (
                  <div className="space-y-2">
                    <Label htmlFor="measured-brix">Measured Original Gravity - Brix (°Bx)</Label>
                    <Input
                      id="measured-brix"
                      type="text"
                      placeholder="e.g. 13.5"
                      value={measuredBrix}
                      onChange={(e) => setMeasuredBrix(e.target.value)}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="measured-volume">Measured Volume in Fermenter ({unitSystem === "metric" ? "Liters" : "Gallons"})</Label>
                  <Input
                    id="measured-volume"
                    type="number"
                    placeholder={unitSystem === "metric" ? "e.g. 21" : "e.g. 5.5"}
                    value={measuredVolume}
                    onChange={(e) => setMeasuredVolume(e.target.value)}
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                
                {efficiencyResult && (
                  <div className={`p-4 rounded-lg border-2 ${
                    efficiencyResult.status === 'good' ? 'bg-green-500/10 border-green-500' :
                    efficiencyResult.status === 'poor' ? 'bg-red-500/10 border-red-500' :
                    'bg-yellow-500/10 border-yellow-500'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Brewhouse Efficiency:</span>
                      <span className={`text-2xl font-bold ${
                        efficiencyResult.status === 'good' ? 'text-green-400' :
                        efficiencyResult.status === 'poor' ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {efficiencyResult.efficiency.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {efficiencyResult.status === 'good' && '✓ Excellent efficiency!'}
                      {efficiencyResult.status === 'ok' && '⚠ Acceptable efficiency'}
                      {efficiencyResult.status === 'poor' && '✗ Low efficiency - check your process'}
                    </p>
                  </div>
                )}
              </div>

              {/* Yeast Pitching */}
              <div className="p-6 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <h3 className="text-lg font-semibold text-[#FFBF00] mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Yeast Pitching
                </h3>
                <div className="space-y-4">
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Yeast</p>
                    <p className="text-lg font-semibold">
                      {recipe.yeast?.name || recipe.ingredients?.yeast?.name || "Yeast"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {recipe.yeast?.amount || recipe.ingredients?.yeast?.amount || ""}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4 p-3 bg-zinc-800/50 rounded-lg">
                    <Checkbox 
                      id="yeast-pitched" 
                      className="h-6 w-6 data-[state=checked]:bg-[#FFBF00] data-[state=checked]:text-black"
                      checked={yeastPitched}
                      onCheckedChange={(checked) => setYeastPitched(!!checked)}
                    />
                    <Label htmlFor="yeast-pitched" className="text-lg cursor-pointer flex-1">
                      Yeast pitched
                    </Label>
                  </div>
                </div>
              </div>

              {/* Start Fermentation Button */}
              <Button
                className="w-full bg-[#4CBB17] text-white hover:bg-[#4CBB17]/90 text-xl py-6"
                size="lg"
                onClick={() => {
                  if (onFinish) {
                    onFinish();
                  }
                  clearSessionData();
                  toast.success("Fermentation started! Good luck with your brew!");
                }}
                disabled={!yeastPitched || !chillChecklist[2]}
              >
                <Activity className="mr-2 h-6 w-6" />
                Start Fermentation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
