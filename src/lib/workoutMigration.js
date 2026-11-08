import { calculate1RM, getLocalDateKey } from './utils.js';

/**
 * Normalizes a single flat workout set record, ensuring all expected fields exist.
 *
 * @param {Object} raw - Raw workout set object
 * @param {number} [fallbackIndex=1] - Fallback set number if missing
 * @returns {Object} Normalized flat workout set record
 */
export function normalizeSingleSet(raw, fallbackIndex = 1) {
  if (!raw || typeof raw !== 'object') return null;

  const timestamp = typeof raw.timestamp === 'number' && !isNaN(raw.timestamp) 
    ? raw.timestamp 
    : Date.now();
  const date = raw.date || getLocalDateKey(timestamp);
  const part = raw.part || '胸';
  const exercise = raw.exercise || '未設定種目';
  const setNum = raw.setNum !== undefined && raw.setNum !== null && !isNaN(parseInt(raw.setNum, 10))
    ? parseInt(raw.setNum, 10)
    : fallbackIndex;

  const weight = parseFloat(raw.weight);
  const reps = parseInt(raw.reps, 10);
  const validWeight = !isNaN(weight) ? weight : 0;
  const validReps = !isNaN(reps) ? reps : 0;

  const rir = raw.rir !== undefined && raw.rir !== null && raw.rir !== '' && !isNaN(parseInt(raw.rir, 10))
    ? parseInt(raw.rir, 10)
    : 2;

  const memo = typeof raw.memo === 'string' ? raw.memo : (typeof raw.note === 'string' ? raw.note : '');
  const formScore = raw.formScore || raw.form || 'perfect';
  const interval = raw.interval !== undefined && raw.interval !== null && !isNaN(parseInt(raw.interval, 10))
    ? parseInt(raw.interval, 10)
    : 120;

  const oneRM = raw.oneRM !== undefined && !isNaN(parseFloat(raw.oneRM))
    ? parseFloat(raw.oneRM)
    : calculate1RM(validWeight, validReps);

  const id = raw.id || `set_${timestamp}_${Math.random().toString(36).substr(2, 7)}`;

  return {
    id,
    date,
    timestamp,
    part,
    exercise,
    setNum,
    weight: validWeight,
    reps: validReps,
    rir,
    memo,
    formScore,
    interval,
    oneRM,
    isPR: Boolean(raw.isPR)
  };
}

/**
 * Checks whether an array of workouts contains legacy horizontal records (with set1_weight).
 *
 * @param {Array} workouts
 * @returns {boolean}
 */
export function isLegacyHorizontalWorkout(workouts) {
  if (!Array.isArray(workouts)) return false;
  return workouts.some(w => w && typeof w === 'object' && w.set1_weight !== undefined);
}

/**
 * Converts any legacy horizontal records or unnormalized flat lists into a unified 1-set = 1-record array.
 * Calculates chronological PR flags and sorts records by timestamp.
 *
 * @param {Array} rawWorkouts - Raw workouts from localStorage or imports
 * @returns {Array} Unified array of flat set records (1 set per record)
 */
export function migrateToFlatWorkouts(rawWorkouts) {
  if (!Array.isArray(rawWorkouts)) return [];

  const flatList = [];

  rawWorkouts.forEach((item, itemIdx) => {
    if (!item || typeof item !== 'object') return;

    // 1. Detect Horizontal Record (set1_weight, set2_weight, ... up to 30)
    const isHorizontal = item.set1_weight !== undefined;
    if (isHorizontal) {
      const baseTimestamp = item.timestamp || Date.now();
      const baseDate = item.date || getLocalDateKey(baseTimestamp);
      const part = item.part || '胸';
      const exercise = item.exercise || '未設定種目';

      let setCounter = 1;
      for (let i = 1; i <= 30; i++) {
        const wKey = `set${i}_weight`;
        const rKey = `set${i}_reps`;
        const rirKey = `set${i}_rir`;
        const memoKey = `set${i}_memo`;
        const fKey = `set${i}_form`;
        const intKey = `set${i}_interval`;

        if (item[wKey] !== undefined && item[wKey] !== null && item[wKey] !== '') {
          const w = parseFloat(item[wKey]);
          const r = parseInt(item[rKey], 10);
          if (!isNaN(w) && !isNaN(r)) {
            const rirVal = item[rirKey] !== undefined && item[rirKey] !== '' && !isNaN(parseInt(item[rirKey], 10))
              ? parseInt(item[rirKey], 10)
              : 2;
            const memoVal = item[memoKey] || item.memo || item.note || '';
            const formVal = item[fKey] || 'perfect';
            const intVal = item[intKey] !== undefined && item[intKey] !== '' && !isNaN(parseInt(item[intKey], 10))
              ? parseInt(item[intKey], 10)
              : 120;
            const setTimestamp = baseTimestamp + (setCounter - 1) * 1000;
            const oneRM = calculate1RM(w, r);

            flatList.push({
              id: `${item.id || baseTimestamp}-${setCounter}`,
              date: baseDate,
              timestamp: setTimestamp,
              part,
              exercise,
              setNum: setCounter,
              weight: w,
              reps: r,
              rir: rirVal,
              memo: memoVal,
              formScore: formVal,
              interval: intVal,
              oneRM,
              isPR: false
            });
            setCounter++;
          }
        }
      }
    } else {
      // 2. Already Flat Record
      const normalized = normalizeSingleSet(item, item.setNum || (itemIdx + 1));
      if (normalized) {
        flatList.push(normalized);
      }
    }
  });

  // Sort chronologically
  flatList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // Compute PR (Personal Record) per exercise chronologically
  const max1RMs = {};
  flatList.forEach(set => {
    const ex = set.exercise;
    const currentMax = max1RMs[ex] || 0;
    if (set.oneRM > currentMax) {
      set.isPR = true;
      max1RMs[ex] = set.oneRM;
    } else {
      set.isPR = false;
    }
  });

  return flatList;
}

/**
 * Smartly merges incoming workout sets into a base workout ledger with zero duplicates.
 * Handles deduplication by unique ID and compound semantic keys (date + exercise + setNum / timestamp).
 * Non-destructively preserves free memo, RIR, and latest values.
 *
 * @param {Array} baseList - Existing local ledger of workout sets
 * @param {Array} incomingList - Synced or imported workout sets
 * @returns {Array} Merged, deduplicated and chronologically sorted set records
 */
export function mergeWorkoutSets(baseList, incomingList) {
  const normalizedBase = migrateToFlatWorkouts(baseList);
  const normalizedIncoming = migrateToFlatWorkouts(incomingList);

  const setMap = new Map();

  const getRecordKey = (rec) => {
    if (rec.id) return `id_${rec.id}`;
    return `semantic_${rec.date}_${rec.exercise}_${rec.setNum || rec.timestamp}`;
  };

  const getSemanticKey = (rec) => {
    return `${rec.date}_${rec.exercise}_${rec.setNum}`;
  };

  // Map semantic key for secondary conflict resolution
  const semanticMap = new Map();

  normalizedBase.forEach(rec => {
    const primaryKey = getRecordKey(rec);
    setMap.set(primaryKey, rec);
    if (rec.date && rec.exercise && rec.setNum) {
      semanticMap.set(getSemanticKey(rec), primaryKey);
    }
  });

  normalizedIncoming.forEach(inc => {
    const primaryKey = getRecordKey(inc);
    const semanticKey = inc.date && inc.exercise && inc.setNum ? getSemanticKey(inc) : null;
    const matchingKey = setMap.has(primaryKey) 
      ? primaryKey 
      : (semanticKey && semanticMap.has(semanticKey) ? semanticMap.get(semanticKey) : null);

    if (!matchingKey) {
      // Completely new set
      setMap.set(primaryKey, inc);
      if (semanticKey) {
        semanticMap.set(semanticKey, primaryKey);
      }
    } else {
      const existing = setMap.get(matchingKey);
      // Determine which record is fresher/more authoritative
      const incIsFresher = (inc.timestamp || 0) >= (existing.timestamp || 0);

      // Determine memo: if fresher record has memo, prioritize it; otherwise retain existing
      let memo = '';
      if (incIsFresher) {
        memo = (inc.memo && inc.memo.trim()) ? inc.memo : (existing.memo || '');
      } else {
        memo = (existing.memo && existing.memo.trim()) ? existing.memo : (inc.memo || '');
      }

      // Determine RIR: prioritize fresher record's value
      let rir = 2;
      if (incIsFresher && inc.rir !== undefined && inc.rir !== '') {
        rir = inc.rir;
      } else if (existing.rir !== undefined && existing.rir !== '') {
        rir = existing.rir;
      } else if (inc.rir !== undefined && inc.rir !== '') {
        rir = inc.rir;
      }

      const mergedRecord = {
        ...(incIsFresher ? inc : existing),
        id: existing.id || inc.id,
        memo,
        rir
      };

      setMap.set(matchingKey, mergedRecord);
    }
  });

  const mergedList = Array.from(setMap.values());
  return migrateToFlatWorkouts(mergedList);
}
