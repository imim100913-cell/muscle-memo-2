package com.example.musclememo.ui.workout

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.musclememo.data.model.WorkoutLog
import com.example.musclememo.domain.TrainingEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Single-use UI events emitted by the ViewModel (e.g. snackbars, navigation).
 */
@Immutable
sealed interface WorkoutUiEvent {
    data class ShowSnackbar(
        val message: String,
        val actionLabel: String? = null,
        val action: (() -> Unit)? = null
    ) : WorkoutUiEvent
}

/**
 * Workout session UI state representing loading, success, and error states.
 */
@Immutable
sealed interface WorkoutUiState {
    object Loading : WorkoutUiState
    
    data class Success(
        val workouts: List<WorkoutLog> = emptyList(),
        val currentPart: String = "胸",
        val currentExercise: String = "ベンチプレス",
        val weightInput: String = "",
        val repsInput: String = "",
        val rirInput: String = "2",
        val formScore: String = "perfect",
        val recommendation: TrainingEngine.RecommendedTarget,
        val todaySessionLogs: List<WorkoutLog> = emptyList(),
        val previousSessionLogs: List<WorkoutLog> = emptyList(),
        val isTimerRunning: Boolean = false,
        val timerRemaining: Int = 0,
        val isSaving: Boolean = false // Saves loading status to lock interaction
    ) : WorkoutUiState

    data class Error(val message: String) : WorkoutUiState
}

/**
 * ViewModel that processes workout logging logic, progressive overload calculations, and UI events.
 */
class WorkoutViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<WorkoutUiState>(WorkoutUiState.Loading)
    val uiState: StateFlow<WorkoutUiState> = _uiState.asStateFlow()

    private val _uiEvent = Channel<WorkoutUiEvent>(Channel.BUFFERED)
    val uiEvent = _uiEvent.receiveAsFlow()

    init {
        loadWorkouts()
    }

    fun loadWorkouts() {
        _uiState.value = WorkoutUiState.Loading
        viewModelScope.launch {
            try {
                // Fetch/simulate history inside IO coroutine context
                val initialHistory = withContext(Dispatchers.IO) {
                    kotlinx.coroutines.delay(800)
                    listOf(
                        WorkoutLog(
                            id = "seed-log-1",
                            timestamp = System.currentTimeMillis() - 3 * 24 * 3600 * 1000,
                            part = "胸",
                            exercise = "ベンチプレス",
                            weight = 80.0,
                            reps = 10,
                            rir = 2,
                            formScore = "perfect",
                            oneRM = 106,
                            isPR = true
                        )
                    )
                }
                updateSuccessState(initialHistory, "胸", "ベンチプレス")
            } catch (e: Exception) {
                _uiState.value = WorkoutUiState.Error("履歴データの取得に失敗しました: ${e.localizedMessage}")
            }
        }
    }

    private suspend fun updateSuccessState(
        history: List<WorkoutLog>,
        part: String,
        exercise: String,
        weight: String = "",
        reps: String = "",
        rir: String = "2",
        score: String = "perfect",
        isSaving: Boolean = false
    ) {
        // Offload calculations to Default Dispatcher (CPU-bound rules)
        val recommendation = withContext(Dispatchers.Default) {
            TrainingEngine.calculateNextTarget(exercise, history)
        }
        
        val todayStr = android.text.format.DateFormat.format("yyyy-MM-dd", System.currentTimeMillis()).toString()
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
        
        val todayLogs = history.filter { 
            it.exercise == exercise && sdf.format(java.util.Date(it.timestamp)) == todayStr 
        }.sortedBy { it.timestamp }

        val pastLogs = history.filter {
            it.exercise == exercise && sdf.format(java.util.Date(it.timestamp)) != todayStr
        }.sortedByDescending { it.timestamp }

        val previousLogs = if (pastLogs.isNotEmpty()) {
            val lastSessionDay = sdf.format(java.util.Date(pastLogs[0].timestamp))
            pastLogs.filter { sdf.format(java.util.Date(it.timestamp)) == lastSessionDay }.reversed()
        } else {
            emptyList()
        }

        _uiState.update {
            WorkoutUiState.Success(
                workouts = history,
                currentPart = part,
                currentExercise = exercise,
                weightInput = weight,
                repsInput = reps,
                rirInput = rir,
                formScore = score,
                recommendation = recommendation,
                todaySessionLogs = todayLogs,
                previousSessionLogs = previousLogs,
                isSaving = isSaving
            )
        }
    }

    fun selectExercise(part: String, exercise: String) {
        val state = _uiState.value
        if (state is WorkoutUiState.Success) {
            viewModelScope.launch {
                updateSuccessState(
                    history = state.workouts,
                    part = part,
                    exercise = exercise,
                    rir = "2" // Reset default RIR
                )
            }
        }
    }

    fun updateWeightInput(weight: String) {
        val state = _uiState.value
        if (state is WorkoutUiState.Success) {
            _uiState.update { state.copy(weightInput = weight) }
        }
    }

    fun updateRepsInput(reps: String) {
        val state = _uiState.value
        if (state is WorkoutUiState.Success) {
            _uiState.update { state.copy(repsInput = reps) }
        }
    }

    fun updateRirInput(rir: String) {
        val state = _uiState.value
        if (state is WorkoutUiState.Success) {
            _uiState.update { state.copy(rirInput = rir) }
        }
    }

    fun updateFormScore(score: String) {
        val state = _uiState.value
        if (state is WorkoutUiState.Success) {
            _uiState.update { state.copy(formScore = score) }
        }
    }

    fun adjustWeight(diff: Double) {
        val state = _uiState.value
        if (state is WorkoutUiState.Success) {
            val base = state.recommendation.weight ?: 60.0
            val current = state.weightInput.toDoubleOrNull() ?: base
            val next = (current + diff).coerceAtLeast(0.0)
            updateWeightInput(next.toString())
        }
    }

    fun adjustReps(diff: Double) {
        val state = _uiState.value
        if (state is WorkoutUiState.Success) {
            val base = 10
            val current = state.repsInput.toIntOrNull() ?: base
            val next = (current + diff.toInt()).coerceAtLeast(0)
            updateRepsInput(next.toString())
        }
    }

    fun adjustRir(diff: Double) {
        val state = _uiState.value
        if (state is WorkoutUiState.Success) {
            val base = 2
            val current = state.rirInput.toIntOrNull() ?: base
            val next = (current + diff.toInt()).coerceIn(0, 5)
            updateRirInput(next.toString())
        }
    }

    fun recordSet() {
        val state = _uiState.value
        if (state is WorkoutUiState.Success && !state.isSaving) {
            val w = state.weightInput.toDoubleOrNull() ?: state.recommendation.weight ?: 60.0
            val r = state.repsInput.toIntOrNull() ?: 10
            val rirVal = state.rirInput.toIntOrNull() ?: 2
            val oneRM = (w * (1.0 + r.toDouble() / 30.0)).toInt()
            
            val exerciseHistory = state.workouts.filter { it.exercise == state.currentExercise }
            val currentMax1RM = exerciseHistory.maxOfOrNull { it.oneRM } ?: 0
            val isPR = oneRM > currentMax1RM

            // Snapshots log model to prevent user changes from corrupting retries
            val newLog = WorkoutLog(
                id = UUID.randomUUID().toString(),
                timestamp = System.currentTimeMillis(),
                part = state.currentPart,
                exercise = state.currentExercise,
                weight = w,
                reps = r,
                rir = rirVal,
                formScore = state.formScore,
                oneRM = oneRM,
                isPR = isPR
            )

            _uiState.update { state.copy(isSaving = true) }

            viewModelScope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        // DB Write Sync Simulation
                        kotlinx.coroutines.delay(500)
                        if (Math.random() < 0.15) {
                            throw java.io.IOException("ローカルDB書き込み中に競合（ロック）が発生しました。")
                        }
                    }
                    val updatedHistory = state.workouts + newLog
                    updateSuccessState(
                        history = updatedHistory,
                        part = state.currentPart,
                        exercise = state.currentExercise,
                        rir = rirVal.toString(),
                        isSaving = false
                    )
                    _uiEvent.send(WorkoutUiEvent.ShowSnackbar(
                        message = if (isPR) "自己ベスト更新！セットを記録しました！" else "セットが保存されました。"
                    ))
                } catch (e: Exception) {
                    _uiState.update { state.copy(isSaving = false) }
                    _uiEvent.send(WorkoutUiEvent.ShowSnackbar(
                        message = "保存エラー: ${e.localizedMessage}",
                        actionLabel = "再試行",
                        action = { retrySaveLog(state, newLog) }
                    ))
                }
            }
        }
    }

    private fun retrySaveLog(successState: WorkoutUiState.Success, log: WorkoutLog) {
        val currentState = _uiState.value
        if (currentState !is WorkoutUiState.Success || currentState.isSaving) return
        
        _uiState.update { currentState.copy(isSaving = true) }

        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    kotlinx.coroutines.delay(500)
                    if (Math.random() < 0.15) {
                        throw java.io.IOException("データベース接続に失敗しました。")
                    }
                }
                val updatedHistory = successState.workouts + log
                updateSuccessState(
                    history = updatedHistory,
                    part = successState.currentPart,
                    exercise = successState.currentExercise,
                    rir = log.rir.toString(),
                    isSaving = false
                )
                _uiEvent.send(WorkoutUiEvent.ShowSnackbar(
                    message = if (log.isPR) "【再試行】自己ベスト更新！セットを記録しました！" else "【再試行】セットが保存されました。"
                ))
            } catch (e: Exception) {
                _uiState.update { currentState.copy(isSaving = false) }
                _uiEvent.send(WorkoutUiEvent.ShowSnackbar(
                    message = "再試行失敗: ${e.localizedMessage}",
                    actionLabel = "再試行",
                    action = { retrySaveLog(successState, log) }
                ))
            }
        }
    }
}
