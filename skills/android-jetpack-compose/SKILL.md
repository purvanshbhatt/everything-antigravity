---
name: android-jetpack-compose
description: >-
  Builds Android apps with Kotlin and Jetpack Compose: unidirectional state
  with ViewModel and StateFlow, state hoisting, recomposition and stability,
  type-safe Navigation Compose, Room persistence and migrations, Hilt
  dependency injection, Gradle version catalogs, and unit, Compose UI and
  screenshot tests. Use when writing or reviewing Compose screens, wiring Room
  or Hilt, fixing recomposition jank, or setting up Android tests.
---

# Android with Jetpack Compose

Build screens as functions of immutable state, keep that state in a
`ViewModel`, and make data, navigation and dependencies explicit so every layer
can be tested without a device. Most Compose bugs are state in the wrong owner;
most Compose jank is unstable parameters or reading state too early.

## When to use

- New Android app or feature in Kotlin with Compose, or migrating XML screens.
- Wiring ViewModels, Navigation Compose, Room or Hilt.
- Lists recompose too often, scrolling janks, or state is lost on rotation or process death.
- Setting up unit, Compose UI, instrumented or screenshot tests.

## When not to use

- Sharing code with iOS: use `kotlin-multiplatform`. Cross-platform JS apps: use `react-native-expo`.
- Kotlin language idioms: use `kotlin-patterns`. Coroutines and Flow depth: use `kotlin-coroutines`.
- Store submission and rollouts: use `app-store-release`. Startup and memory profiling: use `mobile-performance`.

## Workflow

1. **Baseline the build.** Read `gradle/libs.versions.toml` and the module `build.gradle.kts`. Compose versions come from the Compose BOM; with Kotlin 2.x the compiler is the `org.jetbrains.kotlin.plugin.compose` Gradle plugin. Use KSP, not kapt, for Room and Hilt where supported.

   ```bash
   ./gradlew assembleDebug testDebugUnitTest lint     # PowerShell: .\gradlew.bat assembleDebug testDebugUnitTest lint
   ```

   **Check:** The build is green and lint findings are recorded before you change anything.

2. **Model each screen as one state object.** An immutable `UiState` data class exposed as `StateFlow` from a `@HiltViewModel`; user actions are ViewModel functions. A thin route composable connects the ViewModel; the screen composable takes state plus lambdas and is previewable. Collect with `collectAsStateWithLifecycle()`.

   **Check:** Every screen composable has a `@Preview` built from fake state, with no ViewModel.

3. **Navigate with type-safe routes.** Use `@Serializable` route types with Navigation Compose (2.8 or later), pass IDs rather than objects, and read arguments in the ViewModel with `savedStateHandle.toRoute<T>()`. Check whether Navigation 3 suits new projects against current docs.

   **Check:** With "Don't keep activities" enabled in developer options, backgrounding and returning restores the same screen and arguments.

4. **Persist with Room.** Entities, DAOs returning `Flow` for observed queries and `suspend` for writes, `exportSchema = true` with the schema directory committed, and an explicit `Migration` per version bump. Never ship `fallbackToDestructiveMigration()` without the user's explicit approval: it deletes user data.

   **Check:** A `MigrationTestHelper` test migrates from every exported schema version to the latest.

5. **Inject with Hilt.** `@HiltAndroidApp` on the `Application`, `@AndroidEntryPoint` on the activity, `@Module @InstallIn(SingletonComponent::class)` with `@Binds` for interfaces, and `hiltViewModel()` in route composables.

   **Check:** Instrumented tests swap real modules for fakes with `@TestInstallIn` and the app still launches.

6. **Control recomposition.** Pass stable, immutable parameters; give lazy items a `key`; wrap threshold checks in `derivedStateOf`; defer frequently changing reads into lambda modifiers (`Modifier.offset { ... }`, `graphicsLayer { ... }`); `remember` expensive work. Strong skipping is the default in recent Compose compilers (verify for your version); generate compiler reports when stability is unclear.

   **Check:** Layout Inspector recomposition counts show unchanged list rows are skipped while scrolling a release build.

7. **Test at three levels.** ViewModels with `runTest`, a test main dispatcher and Turbine for flows; screens with `createComposeRule()`; device flows with `./gradlew connectedDebugAndroidTest`. Add screenshot tests (Roborazzi, Paparazzi or Compose Preview Screenshot Testing) for design-critical screens.

   **Check:** CI runs unit, Compose UI and screenshot tests on every pull request.

## Patterns

### ViewModel, route and stateless screen

```kotlin
data class TasksUiState(
    val tasks: List<Task> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class TasksViewModel @Inject constructor(private val repo: TaskRepository) : ViewModel() {
    val uiState: StateFlow<TasksUiState> = repo.observeTasks()
        .map { TasksUiState(tasks = it, isLoading = false) }
        .catch { emit(TasksUiState(isLoading = false, error = it.message)) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TasksUiState())

    fun toggle(id: Long) { viewModelScope.launch { repo.toggle(id) } }
}

@Composable
fun TasksRoute(onOpen: (Long) -> Unit, vm: TasksViewModel = hiltViewModel()) {
    val state by vm.uiState.collectAsStateWithLifecycle()
    TasksScreen(state, onToggle = vm::toggle, onOpen = onOpen)
}

@Composable
fun TasksScreen(state: TasksUiState, onToggle: (Long) -> Unit, onOpen: (Long) -> Unit) {
    LazyColumn {
        items(state.tasks, key = { it.id }) { task ->
            TaskRow(task, onToggle = { onToggle(task.id) }, onClick = { onOpen(task.id) })
        }
    }
}
```

### Type-safe routes

```kotlin
@Serializable object Tasks
@Serializable data class TaskDetail(val id: Long)

NavHost(navController, startDestination = Tasks) {
    composable<Tasks> { TasksRoute(onOpen = { navController.navigate(TaskDetail(it)) }) }
    composable<TaskDetail> { TaskDetailRoute() }  // ViewModel: savedStateHandle.toRoute<TaskDetail>()
}
```

### Room migration

```kotlin
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE task ADD COLUMN due_at INTEGER")
    }
}
```

### Where state lives

| State | Owner |
| :--- | :--- |
| Element state (expanded, scroll, text field) | `remember` / `rememberSaveable` in the composable |
| Screen data and loading or error | ViewModel `StateFlow<UiState>` |
| App-wide (session, settings) | Repository or DataStore, injected |
| Navigation arguments | Route type plus `SavedStateHandle` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Pass the ViewModel into child composables | Pass state and lambdas | Children become untestable and unpreviewable |
| `collectAsState()` for app flows | `collectAsStateWithLifecycle()` | Keeps collecting in the background and wastes battery |
| Mutable collections or `var` fields in UI state | Immutable data classes and lists | Unstable params defeat skipping and cause stale UI |
| Lazy items without `key` | `items(list, key = { it.id })` | Reorders recompose and lose item state |
| `fallbackToDestructiveMigration()` in release | Explicit migrations with tests | Silently wipes user data on upgrade |
| kapt for Room and Hilt | KSP | kapt is slower and in maintenance mode |
| Measure performance in debug builds | Release build with a baseline profile | Debug Compose is far slower than release |

## Verification checklist

- [ ] Each screen has one immutable `UiState`, a stateless composable and a preview.
- [ ] Navigation uses typed routes, and state survives process death.
- [ ] Room schemas are exported and every migration has a test.
- [ ] Hilt modules can be replaced with fakes in tests.
- [ ] Lists use keys, and recomposition counts were checked in a release build.
- [ ] Unit, Compose UI and (where relevant) screenshot tests run in CI.

## Related

- Workflows: `/feature-dev`, `/tdd`, `/verify`.
- Knowledge: `kotlin-patterns`, `kotlin-coroutines`, `kotlin-multiplatform`, `mobile-performance`, `app-store-release`, `push-notifications`, `database-design`.
- Agents: `kotlin-reviewer`, `mobile-engineer`, `mobile-build-resolver`, `test-engineer`.
