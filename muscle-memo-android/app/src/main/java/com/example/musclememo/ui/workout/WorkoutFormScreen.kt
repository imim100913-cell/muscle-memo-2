package com.example.musclememo.ui.workout

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.example.musclememo.ui.util.Haptics
import com.example.musclememo.ui.util.shimmer
import com.example.musclememo.data.model.WorkoutLog

@Composable
fun WorkoutFormScreen(
    viewModel: WorkoutViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val haptic = LocalHapticFeedback.current
    val snackbarHostState = remember { SnackbarHostState() }
    val lifecycleOwner = LocalLifecycleOwner.current
    
    // Safely collect UI events in a lifecycle-aware manner (only while STARTED)
    LaunchedEffect(viewModel.uiEvent, lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            viewModel.uiEvent.collect { event ->
                when (event) {
                    is WorkoutUiEvent.ShowSnackbar -> {
                        val result = snackbarHostState.showSnackbar(
                            message = event.message,
                            actionLabel = event.actionLabel,
                            duration = SnackbarDuration.Short
                        )
                        if (result == SnackbarResult.ActionPerformed) {
                            event.action?.invoke()
                        }
                    }
                }
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        modifier = modifier.fillMaxSize(),
        containerColor = Color(0xFFF8FAFC)
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF8FAFC)) // Light gray background optimized for indoor gym visibility
        ) {
            when (val state = uiState) {
                is WorkoutUiState.Loading -> {
                    WorkoutLoadingScreen()
                }
                is WorkoutUiState.Success -> {
                    WorkoutSuccessContent(
                        state = state,
                        // Passing method references directly optimizes recomposition by avoiding lambda recreation
                        onUpdateWeight = viewModel::updateWeightInput,
                        onUpdateReps = viewModel::updateRepsInput,
                        onUpdateRir = viewModel::updateRirInput,
                        onUpdateFormScore = viewModel::updateFormScore,
                        onAdjustWeight = viewModel::adjustWeight,
                        onAdjustReps = viewModel::adjustReps,
                        onAdjustRir = viewModel::adjustRir,
                        onRecordSet = {
                            Haptics.confirm(haptic)
                            viewModel.recordSet()
                        }
                    )
                }
                is WorkoutUiState.Error -> {
                    // Added retry action directly on Error UI state
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = "Error Icon",
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = state.message,
                            color = Color(0xFF0F172A),
                            style = MaterialTheme.typography.titleMedium,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = viewModel::loadWorkouts,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("再読み込み", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun WorkoutLoadingScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Skeleton for Header
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp)
                .clip(RoundedCornerShape(12.dp))
                .shimmer()
        )
        // Skeleton for Targets
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(140.dp)
                .clip(RoundedCornerShape(16.dp))
                .shimmer()
        )
        // Skeleton for Inputs
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(100.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .shimmer()
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(100.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .shimmer()
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(100.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .shimmer()
            )
        }
    }
}

@Composable
fun WorkoutSuccessContent(
    state: WorkoutUiState.Success,
    onUpdateWeight: (String) -> Unit,
    onUpdateReps: (String) -> Unit,
    onUpdateRir: (String) -> Unit,
    onUpdateFormScore: (String) -> Unit,
    onAdjustWeight: (Double) -> Unit,
    onAdjustReps: (Double) -> Unit,
    onAdjustRir: (Double) -> Unit,
    onRecordSet: () -> Unit
) {
    val haptic = LocalHapticFeedback.current

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 80.dp)
    ) {
        // Top Header Info
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Surface(
                            shape = RoundedCornerShape(100.dp),
                            color = Color(0xFFEFF6FF),
                            modifier = Modifier.padding(bottom = 6.dp)
                        ) {
                            Text(
                                text = "${state.currentPart} • RIR導入セッション",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF2563EB),
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                        Text(
                            text = state.currentExercise,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFF0F172A)
                        )
                    }
                }
            }
        }

        // Recommended Target Panel
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0xFFBFDBFE))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "AI 推奨ターゲット",
                            style = MaterialTheme.typography.labelLarge,
                            color = Color(0xFF1D4ED8),
                            fontWeight = FontWeight.Black
                        )
                        Surface(
                            shape = RoundedCornerShape(100.dp),
                            color = Color(0xFFDBEAFE)
                        ) {
                            Text(
                                text = "メゾサイクル週 ${state.recommendation.mesocycleWeek}/4",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF1E40AF),
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                            )
                        }
                    }

                    // 4-Column Target Metrics
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TargetMetricBox("推奨重量", state.recommendation.weight?.let { "${it}kg" } ?: "自己調整", Modifier.weight(1f))
                        TargetMetricBox("推奨レップ", state.recommendation.reps, Modifier.weight(1f))
                        TargetMetricBox("目標RIR", "RIR ${state.recommendation.targetRir}", Modifier.weight(1f), isRir = true)
                        TargetMetricBox("インターバル", "${state.recommendation.intervalSeconds / 60}分", Modifier.weight(1f))
                    }

                    Divider(color = Color(0xFFDBEAFE), thickness = 1.dp)

                    Text(
                        text = state.recommendation.mesocycleDesc,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1D4ED8)
                    )
                    Text(
                        text = state.recommendation.reason,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF334155),
                        lineHeight = 16.sp
                    )
                }
            }
        }

        // Input grid (Weight, Reps, RIR) - Optimizing steps list to primitive steps to solve instability
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Weight Card
                InputCard(
                    title = "重量 (kg)",
                    value = state.weightInput,
                    placeholder = "60",
                    modifier = Modifier.weight(1f),
                    onValueChange = onUpdateWeight,
                    onAdjust = onAdjustWeight,
                    step = 2.5,
                    enabled = !state.isSaving
                )

                // Reps Card
                InputCard(
                    title = "回数 (Reps)",
                    value = state.repsInput,
                    placeholder = "10",
                    modifier = Modifier.weight(1f),
                    onValueChange = onUpdateReps,
                    onAdjust = onAdjustReps,
                    step = 1.0,
                    enabled = !state.isSaving
                )

                // RIR Card
                InputCard(
                    title = "余力 (RIR)",
                    value = state.rirInput,
                    placeholder = "2",
                    modifier = Modifier.weight(1f),
                    onValueChange = onUpdateRir,
                    onAdjust = onAdjustRir,
                    step = 1.0,
                    enabled = !state.isSaving
                )
            }
        }

        // Form Quality Selector
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "フォーム品質 (Form Quality)",
                        style = MaterialTheme.typography.labelLarge,
                        color = Color(0xFF64748B),
                        fontWeight = FontWeight.Bold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FormScoreButton("perfect", "Perfect", "完璧", state.formScore == "perfect", Modifier.weight(1f), enabled = !state.isSaving) {
                            Haptics.click(haptic)
                            onUpdateFormScore("perfect")
                        }
                        FormScoreButton("good", "Good", "通常", state.formScore == "good", Modifier.weight(1f), enabled = !state.isSaving) {
                            Haptics.click(haptic)
                            onUpdateFormScore("good")
                        }
                        FormScoreButton("fail", "Fail", "崩れ", state.formScore == "fail", Modifier.weight(1f), enabled = !state.isSaving) {
                            Haptics.click(haptic)
                            onUpdateFormScore("fail")
                        }
                    }
                }
            }
        }

        // Record Button with Spinner inside during async database saves
        item {
            Button(
                onClick = onRecordSet,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF2563EB)
                ),
                enabled = !state.isSaving
            ) {
                if (state.isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.5.dp
                    )
                } else {
                    Icon(Icons.Default.Check, contentDescription = "Record")
                    Spacer(Modifier.width(8.dp))
                    Text("セット完了を記録する", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
        }

        // Today's sets list (Empty State / Success list)
        item {
            Text(
                text = "本日の記録 (${state.todaySessionLogs.size} セット完了)",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF0F172A),
                modifier = Modifier.padding(top = 10.dp)
            )
        }
        
        if (state.todaySessionLogs.isEmpty()) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0))
                ) {
                    Column(
                        modifier = Modifier
                            .padding(24.dp)
                            .fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "今日の記録はまだありません",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF475569)
                        )
                        Text(
                            text = "上に重量、回数、RIRを入力し、「セット完了を記録する」をタップして最初のトレーニングを記録しましょう！",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF64748B),
                            textAlign = TextAlign.Center,
                            lineHeight = 16.sp
                        )
                    }
                }
            }
        } else {
            itemsIndexed(
                items = state.todaySessionLogs,
                key = { _, log -> log.id }
            ) { index, log ->
                LogCard(index + 1, log)
            }
        }

        // Previous session sets list
        if (state.previousSessionLogs.isNotEmpty()) {
            item {
                Text(
                    text = "前回の記録",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF64748B),
                    modifier = Modifier.padding(top = 10.dp)
                )
            }
            itemsIndexed(
                items = state.previousSessionLogs,
                key = { _, log -> log.id }
            ) { index, log ->
                LogCard(index + 1, log, isPrevious = true)
            }
        }
    }
}

@Composable
fun TargetMetricBox(
    title: String,
    value: String,
    modifier: Modifier = Modifier,
    isRir: Boolean = false
) {
    Column(
        modifier = modifier
            .background(Color.White, RoundedCornerShape(8.dp))
            .border(1.dp, Color(0xFFE2E8F0), RoundedCornerShape(8.dp))
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(title, style = MaterialTheme.typography.labelSmall, color = Color(0xFF64748B), fontSize = 9.sp)
        Spacer(Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Black,
            color = if (isRir) Color(0xFF2563EB) else Color(0xFF0F172A),
            textAlign = TextAlign.Center
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InputCard(
    title: String,
    value: String,
    placeholder: String,
    modifier: Modifier = Modifier,
    onValueChange: (String) -> Unit,
    onAdjust: (Double) -> Unit,
    step: Double,
    enabled: Boolean = true
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF64748B),
                fontWeight = FontWeight.Bold,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Start
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                placeholder = { Text(placeholder, color = Color(0xFF94A3B8)) },
                textStyle = LocalTextStyle.current.copy(
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                    color = Color(0xFF0F172A)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    focusedBorderColor = Color(0xFF2563EB),
                    unfocusedBorderColor = Color(0xFFE2E8F0)
                ),
                shape = RoundedCornerShape(10.dp),
                enabled = enabled
            )
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Symmetrical adjustments minus step
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(28.dp)
                        .background(if (enabled) Color(0xFFF1F5F9) else Color(0xFFF8FAFC), RoundedCornerShape(6.dp))
                        .clickable(enabled = enabled) { onAdjust(-step) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "-$step",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (enabled) Color(0xFF334155) else Color(0xFF94A3B8),
                        fontSize = 10.sp
                    )
                }
                
                // Symmetrical adjustments plus step
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(28.dp)
                        .background(if (enabled) Color(0xFFF1F5F9) else Color(0xFFF8FAFC), RoundedCornerShape(6.dp))
                        .clickable(enabled = enabled) { onAdjust(step) },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "+$step",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (enabled) Color(0xFF334155) else Color(0xFF94A3B8),
                        fontSize = 10.sp
                    )
                }
            }
        }
    }
}

@Composable
fun FormScoreButton(
    score: String,
    label: String,
    desc: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    val containerColor = if (isSelected) {
        when (score) {
            "perfect" -> Color(0xFFEFF6FF)
            "good" -> Color(0xFFF0FDF4)
            else -> Color(0xFFFEF2F2)
        }
    } else Color(0xFFF8FAFC)

    val contentColor = if (isSelected) {
        when (score) {
            "perfect" -> Color(0xFF2563EB)
            "good" -> Color(0xFF16A34A)
            else -> Color(0xFFDC2626)
        }
    } else Color(0xFF64748B)

    val borderColor = if (isSelected) contentColor else Color(0xFFE2E8F0)

    Column(
        modifier = modifier
            .background(containerColor, RoundedCornerShape(12.dp))
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .clickable(enabled = enabled) { onClick() }
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = label, 
            fontSize = 12.sp, 
            fontWeight = FontWeight.Black, 
            color = if (enabled) contentColor else Color(0xFF94A3B8)
        )
        Text(
            text = desc, 
            fontSize = 9.sp, 
            color = if (enabled) contentColor.copy(alpha = 0.8f) else Color(0xFF94A3B8)
        )
    }
}

@Composable
fun LogCard(
    setNum: Int,
    log: WorkoutLog,
    isPrevious: Boolean = false
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isPrevious) Color(0xFFF8FAFC) else Color(0xFFF0FDF4)
        ),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(
            1.dp, 
            if (isPrevious) Color(0xFFE2E8F0) else Color(0xFFDCFCE7)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "セット $setNum",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF64748B)
                )
                Spacer(Modifier.width(8.dp))
                // RIR Badge
                Surface(
                    shape = RoundedCornerShape(100.dp),
                    color = when (log.rir) {
                        0 -> Color(0xFFFEE2E2)
                        1 -> Color(0xFFFEF3C7)
                        2 -> Color(0xFFDCFCE7)
                        3 -> Color(0xFFDBEAFE)
                        else -> Color(0xFFF1F5F9)
                    }
                ) {
                    Text(
                        text = "RIR ${log.rir}",
                        style = MaterialTheme.typography.labelSmall,
                        color = when (log.rir) {
                            0 -> Color(0xFFB91C1C)
                            1 -> Color(0xFFB45309)
                            2 -> Color(0xFF15803D)
                            3 -> Color(0xFF1D4ED8)
                            else -> Color(0xFF475569)
                        },
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            Text(
                text = "${log.weight}kg x ${log.reps}回",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Black,
                color = Color(0xFF0F172A)
            )
        }
    }
}
