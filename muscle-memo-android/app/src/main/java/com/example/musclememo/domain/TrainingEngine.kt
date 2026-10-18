package com.example.musclememo.domain

import androidx.compose.runtime.Immutable
import com.example.musclememo.data.model.WorkoutLog
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.round

/**
 * Pure Kotlin rule engine that governs RIR theory, 4-week mesocycle, and autoregulation.
 */
object TrainingEngine {
    @Immutable
    data class RecommendedTarget(
        val weight: Double?,
        val reps: String,
        val targetRir: Int,
        val mesocycleWeek: Int,
        val mesocycleDesc: String,
        val intervalSeconds: Int,
        val reason: String
    )

    private val COMPOUND_KEYWORDS = listOf(
        "プレス", "スクワット", "デッドリフト", "ロウ", "ローイング", 
        "チンニング", "懸垂", "プルダウン", "ディップス", 
        "press", "squat", "deadlift", "row", "pullups", "dips"
    )

    fun isCompound(exerciseName: String): Boolean {
        val nameLower = exerciseName.lowercase(Locale.getDefault())
        return COMPOUND_KEYWORDS.any { nameLower.contains(it) }
    }

    fun getRecommendedInterval(exerciseName: String): Int {
        return if (isCompound(exerciseName)) 180 else 120 // Compound: 3 mins, Isolation: 2 mins
    }

    fun calculateNextTarget(exerciseName: String, history: List<WorkoutLog>): RecommendedTarget {
        val recommendedInterval = getRecommendedInterval(exerciseName)
        val exerciseHistory = history
            .filter { it.exercise == exerciseName }
            .sortedByDescending { it.timestamp }

        // Group history by date (YYYY-MM-DD) to count distinct session days
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val uniqueDays = exerciseHistory.map { sdf.format(Date(it.timestamp)) }.toSet()

        val nextSessionNum = uniqueDays.size + 1
        val cycleWeek = ((nextSessionNum - 1) % 4) + 1 // 1 to 4
        val compound = isCompound(exerciseName)

        val targetRir: Int
        val mesocycleDesc: String

        if (compound) {
            when (cycleWeek) {
                1 -> {
                    targetRir = 3
                    mesocycleDesc = "第1週 (導入期): やや余裕あり。完璧なフォームコントロールと筋収縮を意識。"
                }
                2 -> {
                    targetRir = 2
                    mesocycleDesc = "第2週 (筋肥大適応期): 筋肥大のスイートスポット。適度な重さをコントロール。"
                }
                3 -> {
                    targetRir = 1
                    mesocycleDesc = "第3週 (過負荷期): かなりキツい。挙上速度低下を感じる高強度セット。"
                }
                else -> {
                    targetRir = 0
                    mesocycleDesc = "第4週 (限界期またはデロード): 全力を出し切り限界に挑む、または休養週。"
                }
            }
        } else {
            when (cycleWeek) {
                1 -> {
                    targetRir = 2
                    mesocycleDesc = "第1週 (導入期): アイソレーション種目。適度な刺激で動作重視。"
                }
                2 -> {
                    targetRir = 1
                    mesocycleDesc = "第2週 (筋肥大適応期): 限界直前まで追い込み、対象筋をピンポイント刺激。"
                }
                3 -> {
                    targetRir = 0
                    mesocycleDesc = "第3週 (限界期): チーティングのない完全収縮でオールアウト。"
                }
                else -> {
                    targetRir = 0
                    mesocycleDesc = "第4週 (デロード / 限界期): 最終週のため限界まで追い込むか、軽重量で回復。"
                }
            }
        }

        if (exerciseHistory.isEmpty()) {
            return RecommendedTarget(
                weight = null,
                reps = if (compound) "8〜10" else "10〜12",
                targetRir = targetRir,
                mesocycleWeek = cycleWeek,
                mesocycleDesc = mesocycleDesc,
                intervalSeconds = recommendedInterval,
                reason = "初回記録のため、コントロール可能な中重量から開始してください。今回の目標強度は RIR $targetRir です。"
            )
        }

        val lastLog = exerciseHistory[0]
        val lastRir = lastLog.rir

        var targetWeight = lastLog.weight
        var targetReps = if (compound) "8〜10" else "10〜12"
        val reason: String

        if (lastLog.formScore == "fail") {
            val rawWeight = lastLog.weight * 0.95
            targetWeight = round(rawWeight * 2.0) / 2.0
            targetReps = if (compound) "10〜12" else "12〜15"
            reason = "前回フォーム崩れ（チーティング）を検知。安全のため重量を 5% 下げ、フォームを再構築してください。"
        } else if (lastRir == 0 && targetRir >= 2) {
            val rawWeight = lastLog.weight * 0.975
            targetWeight = round(rawWeight * 2.0) / 2.0
            targetReps = "${lastLog.reps}回"
            reason = "前回は限界（RIR 0）まで追い込んでいます。今週の目標RIR $targetRir（余力${targetRir}回）に合わせるため、重量を 2.5% 下げて調整します。"
        } else if (lastRir >= targetRir + 2) {
            val rawWeight = lastLog.weight * 1.05
            targetWeight = round(rawWeight * 2.0) / 2.0
            targetReps = "${lastLog.reps}回"
            reason = "前回のセットは負荷が軽すぎました（余力RIR $lastRir）。目標の強度（RIR $targetRir）に近づけるため、重量を 5% アップします。"
        } else {
            val targetRepLimit = if (compound) 10 else 12
            if (cycleWeek == 4) {
                if (lastLog.reps >= targetRepLimit && lastLog.formScore == "perfect") {
                    val rawWeight = lastLog.weight * 1.025
                    targetWeight = round(rawWeight * 2.0) / 2.0
                    targetReps = if (compound) "6〜8" else "8〜10"
                    reason = "メゾサイクル最終週（限界突破期）。前回フォーム完璧のため、重量を 2.5% アップし、RIR 0まで全力で出し切ってください！"
                } else {
                    targetReps = "限界まで"
                    reason = "メゾサイクル最終週（限界突破期）。限界のRIR 0を目指し、前回と同重量で限界まで挙上してください！"
                }
            } else {
                if (lastLog.reps >= targetRepLimit && lastLog.formScore == "perfect") {
                    val rawWeight = lastLog.weight * 1.025
                    targetWeight = round(rawWeight * 2.0) / 2.0
                    targetReps = if (compound) "6〜8" else "8〜10"
                    reason = "前回は目標レップを完遂！メゾサイクルの進行（目標RIR $targetRir）に合わせ、重量を 2.5% アップ（次回: ${targetWeight}kg）します。"
                } else {
                    val nextReps = (lastLog.reps + 1).coerceAtMost(targetRepLimit)
                    targetReps = "${nextReps}回"
                    reason = "前回は ${lastLog.reps}回。今回は重量を維持し、フォーム精度を保ったまま目標RIR $targetRirで 【${nextReps}回】 挙上を目指します。"
                }
            }
        }

        return RecommendedTarget(
            weight = targetWeight,
            reps = targetReps,
            targetRir = targetRir,
            mesocycleWeek = cycleWeek,
            mesocycleDesc = mesocycleDesc,
            intervalSeconds = recommendedInterval,
            reason = reason
        )
    }
}
