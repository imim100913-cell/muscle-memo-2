/**
 * Anti-Gravity 2.0: Hypertrophy Optimization Engine
 */

export const DEFAULT_EXERCISES = {
  "胸": [
    { name: "ベンチプレス", category: "free_weight", mechanics: "compound" },
    { name: "インクライン・ベンチプレス", category: "free_weight", mechanics: "compound" },
    { name: "デクライン・ベンチプレス", category: "free_weight", mechanics: "compound" },
    { name: "ダンベル・ベンチプレス", category: "free_weight", mechanics: "compound" },
    { name: "ダンベル・フライ", category: "free_weight", mechanics: "isolation" },
    { name: "ダンベル・プルオーバー", category: "free_weight", mechanics: "isolation" },
    { name: "チェストプレス・マシン", category: "machine", mechanics: "compound" },
    { name: "ペックフライ（バタフライ）マシン", category: "machine", mechanics: "isolation" },
    { name: "ケーブル・クロスオーバー", category: "machine", mechanics: "isolation" }
  ],
  "背中": [
    { name: "デッドリフト（コンベンショナル）", category: "free_weight", mechanics: "compound" },
    { name: "デッドリフト（スモウ）", category: "free_weight", mechanics: "compound" },
    { name: "ベントオーバー・ロウイング", category: "free_weight", mechanics: "compound" },
    { name: "ワンハンド・ダンベル・ロウ", category: "free_weight", mechanics: "compound" },
    { name: "懸垂（チンニング）", category: "free_weight", mechanics: "compound" },
    { name: "ラットプルダウン", category: "machine", mechanics: "compound" },
    { name: "シーテッド・ローイング", category: "machine", mechanics: "compound" },
    { name: "バックエクステンション", category: "machine", mechanics: "isolation" }
  ],
  "肩": [
    { name: "バーベル・ショルダープレス", category: "free_weight", mechanics: "compound" },
    { name: "ダンベル・ショルダープレス", category: "free_weight", mechanics: "compound" },
    { name: "サイドレイズ", category: "free_weight", mechanics: "isolation" },
    { name: "フロントレイズ", category: "free_weight", mechanics: "isolation" },
    { name: "リアレイズ", category: "free_weight", mechanics: "isolation" },
    { name: "アップライト・ロウ", category: "free_weight", mechanics: "compound" },
    { name: "ショルダープレス・マシン", category: "machine", mechanics: "compound" },
    { name: "リアデルト・マシン", category: "machine", mechanics: "isolation" }
  ],
  "脚": [
    { name: "バーベル・スクワット", category: "free_weight", mechanics: "compound" },
    { name: "フロントスクワット", category: "free_weight", mechanics: "compound" },
    { name: "ブルガリアン・スクワット", category: "free_weight", mechanics: "compound" },
    { name: "ランジ（ウォーキングランジ）", category: "free_weight", mechanics: "compound" },
    { name: "ルーマニアン・デッドリフト", category: "free_weight", mechanics: "compound" },
    { name: "レッグプレス", category: "machine", mechanics: "compound" },
    { name: "レッグエクステンション", category: "machine", mechanics: "isolation" },
    { name: "レッグカール（シーテッド）", category: "machine", mechanics: "isolation" },
    { name: "レッグカール（ライイング）", category: "machine", mechanics: "isolation" },
    { name: "ヒップアブダクション", category: "machine", mechanics: "isolation" },
    { name: "ヒップアダクション", category: "machine", mechanics: "isolation" },
    { name: "カーフレイズ", category: "free_weight", mechanics: "isolation" }
  ],
  "腕": [
    { name: "バーベル・アームカール", category: "free_weight", mechanics: "isolation" },
    { name: "ダンベル・アームカール", category: "free_weight", mechanics: "isolation" },
    { name: "ハンマーカール", category: "free_weight", mechanics: "isolation" },
    { name: "スカルクラッシャー", category: "free_weight", mechanics: "compound" },
    { name: "ダンベル・トライセプスエクステンション", category: "free_weight", mechanics: "isolation" },
    { name: "ディップス", category: "free_weight", mechanics: "compound" },
    { name: "ケーブル・カール", category: "machine", mechanics: "isolation" },
    { name: "ケーブル・トライセプスエクステンション", category: "machine", mechanics: "isolation" }
  ]
};

/**
 * Checks if an exercise is a multi-joint (compound) movement.
 * @param {string} exerciseName - Exercise name.
 * @returns {boolean}
 */
export function isCompound(exerciseName) {
  // 1. Look up in presets
  for (const part in DEFAULT_EXERCISES) {
    const found = DEFAULT_EXERCISES[part].find(ex => ex.name === exerciseName);
    if (found) {
      return found.mechanics === 'compound';
    }
  }
  // 2. Keyword fallback for custom exercises
  const compoundKeywords = ["プレス", "スクワット", "デッドリフト", "ロウ", "ローイング", "チンニング", "懸垂", "プルダウン", "ディップス", "press", "squat", "deadlift", "row", "pullups", "dips"];
  const nameLower = exerciseName.toLowerCase();
  return compoundKeywords.some(keyword => nameLower.includes(keyword));
}

/**
 * Gets the recommended rest interval in seconds for an exercise.
 * @param {string} exercise - Exercise name.
 * @returns {number} - Interval in seconds.
 */
export function getRecommendedInterval(exercise) {
  return isCompound(exercise) ? 180 : 120; // Compound: 3 mins, Isolation: 2 mins
}

/**
 * Calculates the next recommended target parameters.
 * @param {string} exercise - Exercise name.
 * @param {Array} history - Workouts history array.
 * @returns {Object} - Recommended weight, reps, and interval.
 */
export function calculateNextTarget(exercise, history = []) {
  const recommendedInterval = getRecommendedInterval(exercise);
  const exerciseHistory = history
    .filter(w => w.exercise === exercise)
    .sort((a, b) => b.timestamp - a.timestamp); // Sorted descending (most recent first)

  // Determine unique training days for this exercise to compute mesocycle week
  const uniqueDays = new Set(
    exerciseHistory.map(w => new Date(w.timestamp).toDateString())
  );
  
  // The next session is uniqueDays.size + 1
  const nextSessionNum = uniqueDays.size + 1;
  const cycleWeek = ((nextSessionNum - 1) % 4) + 1; // 1 to 4
  const compound = isCompound(exercise);

  let targetRir;
  let mesocycleDesc;

  if (compound) {
    if (cycleWeek === 1) {
      targetRir = 3;
      mesocycleDesc = "第1週 (導入期): やや余裕あり。完璧なフォームコントロールと筋収縮を意識。";
    } else if (cycleWeek === 2) {
      targetRir = 2;
      mesocycleDesc = "第2週 (筋肥大適応期): 筋肥大のスイートスポット。適度な重さをコントロール。";
    } else if (cycleWeek === 3) {
      targetRir = 1;
      mesocycleDesc = "第3週 (過負荷期): かなりキツい。挙上速度低下を感じる高強度セット。";
    } else {
      targetRir = 0;
      mesocycleDesc = "第4週 (限界期またはデロード): 全力を出し切り限界に挑む、または休養週。";
    }
  } else {
    // Isolation
    if (cycleWeek === 1) {
      targetRir = 2;
      mesocycleDesc = "第1週 (導入期): アイソレーション種目。適度な刺激で動作重視。";
    } else if (cycleWeek === 2) {
      targetRir = 1;
      mesocycleDesc = "第2週 (筋肥大適応期): 限界直前まで追い込み、対象筋をピンポイント刺激。";
    } else if (cycleWeek === 3) {
      targetRir = 0;
      mesocycleDesc = "第3週 (限界期): チーティングのない完全収縮でオールアウト。";
    } else {
      targetRir = 0;
      mesocycleDesc = "第4週 (デロード / 限界期): 最終週のため限界まで追い込むか、軽重量で回復。";
    }
  }

  if (exerciseHistory.length === 0) {
    return {
      weight: null,
      reps: compound ? "8〜10" : "10〜12",
      targetRir,
      mesocycleWeek: cycleWeek,
      mesocycleDesc,
      interval: recommendedInterval,
      reason: `初回記録のため、コントロール可能な中重量から開始してください。今回の目標強度は RIR ${targetRir} です。`
    };
  }

  // Find the most recent log
  const lastLog = exerciseHistory[0];
  const lastRir = lastLog.rir !== undefined ? lastLog.rir : 2; // Default to 2 if missing

  // RIR Autoregulation & Progressive Overload calculations
  let targetWeight = lastLog.weight;
  let targetReps = compound ? "8〜10" : "10〜12";
  let reason = "";

  if (lastLog.formScore === 'fail') {
    // Drop weight by 5% due to form failure
    const rawWeight = lastLog.weight * 0.95;
    targetWeight = Math.round(rawWeight * 2) / 2;
    targetReps = compound ? "10〜12" : "12〜15";
    reason = "前回フォーム崩れ（チーティング）を検知。安全のため重量を 5% 下げ、フォームを再構築してください。";
  } else if (lastRir === 0 && targetRir >= 2) {
    // Last time pushed to failure (RIR 0) but target this week is light (RIR >= 2)
    // Reduce weight by 2.5% to ensure they have the targeted reserve reps
    const rawWeight = lastLog.weight * 0.975;
    targetWeight = Math.round(rawWeight * 2) / 2;
    targetReps = `${lastLog.reps}回`;
    reason = `前回は限界（RIR 0）まで追い込んでいます。今週の目標RIR ${targetRir}（余力${targetRir}回）に合わせるため、重量を 2.5% 下げて調整します。`;
  } else if (lastRir >= targetRir + 2) {
    // Too light (too much reserve)
    // Increase weight by 5% to reach target intensity
    const rawWeight = lastLog.weight * 1.05;
    targetWeight = Math.round(rawWeight * 2) / 2;
    targetReps = `${lastLog.reps}回`;
    reason = `前回のセットは負荷が軽すぎました（余力RIR ${lastRir}）。目標の強度（RIR ${targetRir}）に近づけるため、重量を 5% アップします。`;
  } else {
    // Normal progress / target match (RIR is within 1 of target)
    if (cycleWeek === 4) {
      // Mesocycle week 4 is RIR 0/limit
      if (lastLog.reps >= (compound ? 10 : 12) && lastLog.formScore === 'perfect') {
        const rawWeight = lastLog.weight * 1.025;
        targetWeight = Math.round(rawWeight * 2) / 2;
        targetReps = compound ? "6〜8" : "8〜10";
        reason = `メゾサイクル最終週（限界突破期）。前回フォーム完璧のため、重量を 2.5% アップし、RIR 0まで全力で出し切ってください！`;
      } else {
        targetReps = "限界まで";
        reason = "メゾサイクル最終週（限界突破期）。限界のRIR 0を目指し、前回と同重量で限界まで挙上してください！";
      }
    } else {
      // Normal overload progress week 1 to 3
      if (lastLog.reps >= (compound ? 10 : 12) && lastLog.formScore === 'perfect') {
        const rawWeight = lastLog.weight * 1.025;
        targetWeight = Math.round(rawWeight * 2) / 2;
        targetReps = compound ? "6〜8" : "8〜10";
        reason = `前回は目標レップを完遂！メゾサイクルの進行（目標RIR ${targetRir}）に合わせ、重量を 2.5% アップ（次回: ${targetWeight}kg）します。`;
      } else {
        // Maintain weight, aim for same reps or +1 rep to progress
        const nextReps = Math.min(compound ? 10 : 12, lastLog.reps + 1);
        targetReps = `${nextReps}回`;
        reason = `前回は ${lastLog.reps}回。今回は重量を維持し、フォーム精度を保ったまま目標RIR ${targetRir}で 【${nextReps}回】 挙上を目指します。`;
      }
    }
  }

  return {
    weight: targetWeight,
    reps: targetReps,
    targetRir,
    mesocycleWeek: cycleWeek,
    mesocycleDesc,
    interval: recommendedInterval,
    reason
  };
}
