import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function calculate1RM(weight, reps) {
    if (reps === 1) return weight;
    // Epley Formula: 1RM = Weight * (1 + Reps/30)
    return Math.round(weight * (1 + reps / 30));
}

export function getSessionStatus(lastLogTimestamp) {
    if (!lastLogTimestamp) return "inactive";
    const now = Date.now();
    const diffMinutes = (now - lastLogTimestamp) / (1000 * 60);
    return diffMinutes <= 90 ? "active" : "inactive";
}
