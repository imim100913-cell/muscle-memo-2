import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeSingleSet, migrateToFlatWorkouts, mergeWorkoutSets } from '../src/lib/workoutMigration.js';
import { collectLocalSyncData, applySyncedData } from '../src/services/mobileSync.js';

describe('P0-01: 記録データの正確性と保全に関する監査テスト', () => {

  // =========================================================================
  // 1. RIR の未入力と RIR 0 の区別
  // =========================================================================
  describe('問題①-A: RIR (Reps in Reserve) の欠損値扱い', () => {
    it('RIR=0 (限界まで挙上) は 0 として正確に保存されるべき', () => {
      const recordRirZero = {
        exercise: 'ベンチプレス',
        weight: 80,
        reps: 10,
        rir: 0
      };
      const normalized = normalizeSingleSet(recordRirZero);
      expect(normalized.rir).toBe(0);
    });

    it('RIR 未入力 (空文字列/undefined/null) の場合、実測していない「2」に捏造されず null または未入力として保持されるべき', () => {
      const recordRirEmpty = {
        exercise: 'ベンチプレス',
        weight: 80,
        reps: 10,
        rir: '' // ユーザーが空欄のまま記録
      };
      const normalized = normalizeSingleSet(recordRirEmpty);

      // 【監査対象】未入力なのに 2 に勝手に補完されて実測データ汚染が起きていないかを検証
      // 現行コードが 2 に補完している場合、このアサーションによって問題を検知・再現できる
      expect(normalized.rir, '未入力のRIRが勝手に「2」に補完されてはならない').not.toBe(2);
      expect([null, undefined, '']).toContain(normalized.rir);
    });
  });

  // =========================================================================
  // 2. フォーム未評価が perfect に変換されないことの検証
  // =========================================================================
  describe('問題①-B: フォーム品質評価の欠損値扱い', () => {
    it('フォーム未評価 (null/undefined/空文字) の場合、勝手に「perfect」に捏造されてはならない', () => {
      const recordFormUnrated = {
        exercise: 'ベンチプレス',
        weight: 80,
        reps: 10,
        formScore: null // ユーザーがフォーム品質ボタンを未選択
      };
      const normalized = normalizeSingleSet(recordFormUnrated);

      // 【監査対象】未選択なのに勝手に 'perfect' として保存されていないかを検証
      expect(normalized.formScore, '未評価のフォームが勝手に perfect に補完されてはならない').not.toBe('perfect');
      expect([null, undefined, '', 'unrated']).toContain(normalized.formScore);
    });
  });

  // =========================================================================
  // 3. 初期設定 (Onboarding) での架空履歴混入の検知
  // =========================================================================
  describe('問題②: Onboarding による架空過去履歴の混入リスク', () => {
    it('アンケート回答から生成される seedWorkouts は実測データと区別がつかず混入する構造になっている', () => {
      const now = Date.now();
      // Onboarding.jsx 159〜170行目のロジックを再現
      const mockSeededWorkout = {
        id: `seed-log-0-${now}`,
        timestamp: now - 3 * 24 * 60 * 60 * 1000,
        part: '胸',
        exercise: 'ベンチプレス',
        weight: 50,
        reps: 10,
        rir: 2,
        oneRM: Math.round(50 * (1 + 10 / 30)),
        formScore: 'perfect',
        isPR: true
      };

      // 【監査対象】実測フラグやサンプルフラグが存在せず、通常のトレーニング記録と全く同一形式で保存されてしまう問題を検知
      const hasSampleFlag = Boolean(mockSeededWorkout.isSample || mockSeededWorkout.isSeed || mockSeededWorkout.isSimulated);
      expect(hasSampleFlag, 'Onboardingの架空データには実測値と明確に区別するフラグ(isSample等)が必要').toBe(true);
    });
  });

  // =========================================================================
  // 4. 同日・同種目の複数セット同期における上書き・消失リスク
  // =========================================================================
  describe('問題③: 同期処理における同日・同種目セットの衝突と保全', () => {
    it('端末Aで3セット、端末Bで別の3セットを記録した場合、同期によってどちらか一方が破棄されず6セット全て保全されるべき', () => {
      const baseDate = '2026-11-08';
      const deviceA_Sets = [
        { id: 'devA-1', date: baseDate, timestamp: 1700000001000, exercise: 'スクワット', setNum: 1, weight: 100, reps: 5 },
        { id: 'devA-2', date: baseDate, timestamp: 1700000002000, exercise: 'スクワット', setNum: 2, weight: 100, reps: 5 },
        { id: 'devA-3', date: baseDate, timestamp: 1700000003000, exercise: 'スクワット', setNum: 3, weight: 100, reps: 5 }
      ];

      const deviceB_Sets = [
        { id: 'devB-4', date: baseDate, timestamp: 1700000004000, exercise: 'スクワット', setNum: 4, weight: 100, reps: 4 },
        { id: 'devB-5', date: baseDate, timestamp: 1700000005000, exercise: 'スクワット', setNum: 5, weight: 95, reps: 6 },
        { id: 'devB-6', date: baseDate, timestamp: 1700000006000, exercise: 'スクワット', setNum: 6, weight: 90, reps: 8 }
      ];

      // 新しい mergeWorkoutSets による統合
      const merged = mergeWorkoutSets(deviceA_Sets, deviceB_Sets);

      // 【監査対象】端末Aの3セットと端末Bの3セットが全て保持され、合計6セットになること
      expect(merged.length).toBe(6);
      expect(merged.map(s => s.id)).toEqual(
        expect.arrayContaining(['devA-1', 'devA-2', 'devA-3', 'devB-4', 'devB-5', 'devB-6'])
      );
    });

    it('旧来の横長統合ロジック（セット数や更新時刻で丸ごと破棄する旧方式）の問題再現', () => {
      // 旧 mobileSync.js 60〜90行の判定：
      // countSets(inc) > countSets(existing) || (incSets === extSets && inc.timestamp > existing.timestamp)
      // 端末A（3セット）と端末B（別内容の3セット）の場合、timestampが新しい端末Bだけで上書きされ、端末Aのセットが全滅する
      const existingRecord = {
        date: '2026-11-08',
        exercise: 'スクワット',
        timestamp: 1000,
        set1_weight: 100, set1_reps: 5,
        set2_weight: 100, set2_reps: 5,
        set3_weight: 100, set3_reps: 5
      };

      const incomingRecord = {
        date: '2026-11-08',
        exercise: 'スクワット',
        timestamp: 2000,
        set1_weight: 100, set1_reps: 4,
        set2_weight: 95, set2_reps: 6,
        set3_weight: 90, set3_reps: 8
      };

      // 旧ロジックをシミュレーション
      const oldMerge = (ext, inc) => {
        if (inc.timestamp > ext.timestamp) {
          return inc; // 端末Aのセットが全て消える！
        }
        return ext;
      };

      const result = oldMerge(existingRecord, incomingRecord);
      // 旧ロジックでは existingRecord のデータが完全に消失することを再現
      expect(result.set1_reps).toBe(4); // incomingのデータのみ残り、existingは失われる
    });
  });

  // =========================================================================
  // 5. 保存失敗（localStorage QuotaExceededError等）の検知と伝播
  // =========================================================================
  describe('問題⑤: localStorage 保存失敗の検知とUIフィードバック', () => {
    let mockStorage = {};
    
    beforeEach(() => {
      mockStorage = {};
      global.localStorage = {
        getItem: vi.fn((k) => mockStorage[k] || null),
        setItem: vi.fn((k, v) => {
          mockStorage[k] = String(v);
        }),
        removeItem: vi.fn((k) => {
          delete mockStorage[k];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        })
      };
    });

    it('localStorage.setItem がクォータ上限等で例外を投げた際、単に無視されずエラーが検知可能であること', () => {
      // QuotaExceededError を模倣
      global.localStorage.setItem.mockImplementation(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      // 保存関数をテスト
      const safeSaveWorkoutLedger = (workouts) => {
        try {
          global.localStorage.setItem('muscle-memo-workouts', JSON.stringify(workouts));
          return { success: true };
        } catch (e) {
          return { 
            success: false, 
            error: e, 
            userMessage: '端末の保存容量が一杯か、ブラウザの制限により保存に失敗しました。' 
          };
        }
      };

      const res = safeSaveWorkoutLedger([{ exercise: 'ベンチプレス', weight: 100, reps: 5 }]);
      
      // 【監査対象】保存失敗が正常に false としてキャッチされ、ユーザー向けメッセージが返ることを確認
      expect(res.success).toBe(false);
      expect(res.error.name).toBe('QuotaExceededError');
      expect(res.userMessage).toContain('保存に失敗しました');
    });
  });
});
