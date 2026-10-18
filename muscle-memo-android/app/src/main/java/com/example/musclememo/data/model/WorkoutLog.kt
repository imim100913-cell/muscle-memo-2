package com.example.musclememo.data.model

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable

/**
 * Data model representing a recorded training set.
 * Stored locally in SQLite (Room) and synced to Google Drive in JSON format.
 */
@Immutable
@Serializable
data class WorkoutLog(
    val id: String,
    val timestamp: Long,
    val part: String,          // e.g. "胸", "背中"
    val exercise: String,      // e.g. "ベンチプレス"
    val weight: Double,        // in kg
    val reps: Int,
    val rir: Int,              // Reps in Reserve (0 to 5)
    val formScore: String,     // "perfect", "good", "fail"
    val oneRM: Int,            // Estimated 1RM
    val isPR: Boolean = false
)
