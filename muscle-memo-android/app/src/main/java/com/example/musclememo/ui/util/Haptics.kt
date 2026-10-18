package com.example.musclememo.ui.util

import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType

/**
 * Anti-Gravity 2.0: Android Haptic Feedback Blueprint
 * Provides tactile sensations aligned with Material 3 guidelines.
 */
object Haptics {
    /**
     * Light haptic click for adjusting weight, reps, or RIR.
     */
    fun click(hapticFeedback: HapticFeedback) {
        hapticFeedback.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }

    /**
     * Long haptic press for set logging confirmation.
     */
    fun confirm(hapticFeedback: HapticFeedback) {
        hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    /**
     * Double haptic trigger or distinct vibration when a new PR is achieved.
     */
    fun celebrate(hapticFeedback: HapticFeedback) {
        hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
    }
}
