---
name: kotlin-coroutines
description: >-
  Uses Kotlin coroutines and Flow correctly: structured concurrency with
  coroutineScope and supervisorScope, dispatchers and withContext, cooperative
  cancellation and never swallowing CancellationException, timeouts, exception
  propagation, cold Flow operators, StateFlow versus SharedFlow, callbackFlow,
  and testing with runTest, virtual time and Turbine. Use when writing or
  debugging suspend functions, Flows, ViewModels or coroutine-based services.
---

# Kotlin Coroutines and Flow

Every coroutine belongs to a scope, every scope has an owner that cancels it,
and every blocking call runs on a dispatcher meant for it. Cancellation is
cooperative and travels as an exception, so code that catches everything breaks
it.

## When to use

- Writing suspend functions, parallel decomposition, or coroutine-based servers.
- Leaks, work continuing after a screen or request ends, or "JobCancellationException" noise.
- Choosing between `Flow`, `StateFlow`, `SharedFlow` and `Channel`.
- Wrapping callback APIs, or testing time-dependent coroutine code.

## When not to use

- General Kotlin idioms and modelling: use `kotlin-patterns`.
- Ktor routing and plugins: use `ktor-server`; Compose UI state: `android-jetpack-compose`.
- Diagnosing races and deadlocks across runtimes: use `concurrency-bugs`.
- A review: delegate to the `kotlin-reviewer` agent.

## Workflow

1. **Find every scope and its owner.** `grep_search` for `GlobalScope`, `CoroutineScope(`, `launch`, `async` and `runBlocking`. Valid owners: `viewModelScope`, `lifecycleScope`, a request scope, or an application-level scope you cancel on shutdown.

   **Check:** No `GlobalScope`; `runBlocking` appears only in `main` or tests.

2. **Decompose with `coroutineScope`.** Parallel work inside a suspend function uses `coroutineScope { async {...}; async {...} }`; a failure cancels siblings and propagates. Use `supervisorScope` only when children must fail independently, and handle each child's failure explicitly.

   **Check:** A test where one child throws shows the siblings cancelled and the exception surfacing to the caller.

3. **Put work on the right dispatcher.** Blocking I/O in `withContext(Dispatchers.IO)`; CPU work on `Dispatchers.Default`; UI on `Dispatchers.Main`. Inject dispatchers as constructor parameters so tests can replace them. Cap parallelism with `Dispatchers.IO.limitedParallelism(n)`.

   **Check:** No blocking call (JDBC, file I/O, `Thread.sleep`) runs on `Main` or `Default`.

4. **Respect cancellation.** Long CPU loops call `ensureActive()` or `yield()`. Never swallow `CancellationException`: rethrow it from broad `catch` blocks and avoid `runCatching` around suspend calls. Use `withContext(NonCancellable)` only for short cleanup.

   **Check:** Cancelling the parent stops the work within one loop iteration (test it).

5. **Bound waits.** `withTimeout` throws `TimeoutCancellationException`; `withTimeoutOrNull` returns null. Put a timeout on every network call that the client library does not already bound.

   **Check:** Each outbound call in the diff has a timeout from the client or a `withTimeout`.

6. **Pick the right stream type** (table below). Expose `StateFlow` or `Flow` publicly and keep `MutableStateFlow` private; update state atomically with `update { }`.

   **Check:** No public `MutableStateFlow` or `MutableSharedFlow` in changed APIs.

7. **Test with virtual time.** Use `runTest` from kotlinx-coroutines-test, pass `StandardTestDispatcher(testScheduler)` to the code under test, and assert Flow emissions with Turbine.

   **Check:** Tests involving delays or timeouts complete in milliseconds.

## Patterns

### Parallel decomposition and dispatcher injection

```kotlin
class DashboardRepository(
    private val api: DashboardApi,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    suspend fun load(id: UserId): Dashboard = coroutineScope {
        val profile = async { api.profile(id) }          // both run concurrently
        val orders = async { api.orders(id) }
        Dashboard(profile.await(), orders.await())       // one failure cancels the other
    }

    suspend fun readCache(path: Path): String = withContext(io) { path.readText() }
}
```

### Cancellation-safe error handling

```kotlin
suspend fun <T> retryWithBackoff(times: Int, initialDelayMs: Long, block: suspend () -> T): T {
    var delayMs = initialDelayMs
    repeat(times - 1) {
        try {
            return block()
        } catch (e: CancellationException) {
            throw e                                      // never swallow cancellation
        } catch (e: IOException) {
            delay(delayMs)
            delayMs *= 2
        }
    }
    return block()
}
```

### Choosing a stream type

| Type | Semantics | Use for |
| :--- | :--- | :--- |
| `Flow` | Cold; runs per collector | Database queries, paginated loads, transformations |
| `StateFlow` | Hot; always has a value; conflates; skips equal values | UI state, current settings |
| `SharedFlow` | Hot; configurable replay and buffer | Broadcast events to several subscribers |
| `Channel` | Hot; each element to one receiver | Work queues, one-shot events with a single consumer |
| `callbackFlow` | Bridges callback APIs; must end with `awaitClose { unregister() }` | Location updates, listeners, sockets |

Operators to know: `flowOn` (changes upstream dispatcher), `catch` (upstream errors only), `buffer`/`conflate` (backpressure), `collectLatest` (cancel stale work), `distinctUntilChanged`, `debounce`.

### ViewModel state

```kotlin
class ItemsViewModel(repo: ItemsRepository) : ViewModel() {
    val state: StateFlow<UiState> = repo.observeItems()
        .map<List<Item>, UiState> { UiState.Loaded(it) }
        .catch { emit(UiState.Error(it.message ?: "unknown error")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), UiState.Loading)
}
```

`WhileSubscribed(5_000)` keeps the upstream alive across configuration changes but stops it when nobody is watching.

### Testing with virtual time and Turbine

```kotlin
@Test
fun retriesWithExponentialBackoff() = runTest {
    var calls = 0
    val result = retryWithBackoff(times = 3, initialDelayMs = 1_000) {
        if (++calls < 3) throw IOException("flaky") else "ok"
    }
    assertEquals("ok", result)
    assertEquals(3_000, currentTime)                     // 1s + 2s of virtual time, no real waiting
}

@Test
fun emitsLoadedState() = runTest {
    val repo = FakeItemsRepository()
    val vm = ItemsViewModel(repo)
    vm.state.test {                                      // Turbine
        assertEquals(UiState.Loading, awaitItem())
        repo.emit(listOf(item))
        assertEquals(UiState.Loaded(listOf(item)), awaitItem())
        cancelAndIgnoreRemainingEvents()
    }
}
```

For code that uses `Dispatchers.Main` (ViewModels), call `Dispatchers.setMain(StandardTestDispatcher())` in setup and `Dispatchers.resetMain()` in teardown.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `GlobalScope.launch` | An owned scope cancelled with its owner | Leaks work and hides failures |
| `catch (e: Exception)` around suspend calls without rethrowing cancellation | Rethrow `CancellationException` first | Breaks structured cancellation |
| `runBlocking` inside suspend code or on Android main | `suspend` all the way, or `withContext` | Deadlocks and frozen UI |
| `async` without `await` for fire-and-forget | `launch` in an owned scope | Exceptions from unawaited `async` are surprising |
| Hard-coded `Dispatchers.IO` inside classes | Inject a dispatcher | Untestable without real threads |
| `CoroutineExceptionHandler` on child coroutines | Install it on the root scope or handle locally | It is ignored on children |
| `delay` in tests with real time | `runTest` and virtual time | Slow, flaky suites |

## Verification checklist

- [ ] Every coroutine has an owning scope; no `GlobalScope`.
- [ ] Blocking work runs on `Dispatchers.IO` or an injected dispatcher.
- [ ] `CancellationException` is never swallowed; loops check `ensureActive()`.
- [ ] Outbound calls have timeouts.
- [ ] Mutable flows are private; state updates use `update { }`.
- [ ] Tests use `runTest`, injected test dispatchers and Turbine.

## Related

- Knowledge: `kotlin-patterns`, `ktor-server`, `android-jetpack-compose`, `kotlin-multiplatform`, `concurrency-bugs`.
- Workflows: `/tdd`, `/root-cause`.
- Agents: `kotlin-reviewer`, `test-engineer`.
