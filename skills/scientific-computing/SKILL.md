---
name: scientific-computing
description: >-
  Scientific computing in Python: NumPy vectorization and broadcasting,
  dtypes and memory layout, numerical stability (cancellation, log-sum-exp,
  conditioning, solve versus inverse), SciPy solvers and ODE integrators,
  seeded random generators, acceleration with Numba or JAX, testing numerical
  code, and reproducible experiments. Use when writing simulations, numerical
  methods or data-heavy research code, or when results look slow or wrong.
---

# Scientific Computing

Numerical code can be fast and wrong at the same time. Vectorize for speed,
reason about floating point for correctness, and record everything needed to
reproduce a result: code version, environment, seeds, inputs and hardware.

## When to use

- Writing simulations, numerical methods, signal processing or optimization code.
- A loop over NumPy arrays is slow, or memory blows up.
- Results differ between runs or machines, contain NaN or infinity, or drift.
- Packaging an analysis so someone else can reproduce a figure or number.

## When not to use

- Notebook structure and parameterized runs: use `jupyter-notebooks`.
- Training neural networks: use `pytorch-training`; statistical model evaluation: `ml-evaluation`.
- Optimization models with constraints (LP, MIP, scheduling): use `operations-research`.
- Distributed data processing: use `pyspark`.

## Workflow

1. **Pin the environment.** Lock exact versions (uv or pip-tools lockfile, conda-lock) and record Python, NumPy, SciPy, BLAS backend and CPU/GPU. Save `np.show_config()` output with results.

   **Check:** A fresh environment from the lockfile reproduces a reference result bit-for-bit or within a stated tolerance.

2. **Seed randomness explicitly.** Use the Generator API and spawn independent streams for parallel workers.

   ```python
   import numpy as np
   root = np.random.SeedSequence(20260301)
   rngs = [np.random.default_rng(s) for s in root.spawn(8)]   # one per worker
   samples = rngs[0].normal(size=1_000)
   ```

   **Check:** No `np.random.seed` or global `random` use remains (`grep_search`), and the seed is logged with outputs.

3. **Vectorize before optimizing further.** Replace Python loops with array expressions and broadcasting; use `out=` and in-place operations for large arrays; watch dtypes (`float32` halves memory but has about 7 significant digits).

   ```python
   # pairwise distances without loops: (n,1,d) - (1,m,d) -> (n,m,d)
   d = np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(axis=-1))
   ```

   For very large `n x m`, chunk the computation or use `scipy.spatial.distance.cdist` to bound memory.

   **Check:** Profiling (`%timeit`, `line_profiler`, `py-spy`) shows the hot spot moved out of Python-level loops.

4. **Make the math numerically stable** (table below): avoid subtracting nearly equal numbers, use `log1p`/`expm1`, log-sum-exp for softmax and likelihoods, `math.fsum` or pairwise sums for long accumulations, and `np.linalg.solve` or `lstsq` instead of explicit inverses. Check conditioning with `np.linalg.cond`.

   **Check:** Results are stable when inputs are perturbed slightly and when switching `float32` to `float64`.

5. **Pick the right SciPy tool.** `scipy.integrate.solve_ivp` (use `Radau`, `BDF` or `LSODA` for stiff systems), `scipy.optimize.minimize` / `least_squares` / `root`, `scipy.sparse` and `scipy.sparse.linalg` for large sparse systems, `scipy.interpolate`, `scipy.stats`. Set tolerances explicitly and check solver status flags.

   **Check:** Every solver call checks `success` (or equivalent) and logs iterations or warnings.

6. **Accelerate only measured hot spots.** Numba `@njit` for loop-heavy kernels, JAX `jit`/`vmap` for array programs and autodiff (it defaults to 32-bit floats unless 64-bit mode is enabled), CuPy for GPU arrays, Dask for out-of-core or parallel arrays.

   **Check:** Accelerated code matches the reference implementation within tolerance on a test set.

7. **Test numerical code properly.** Compare against analytic solutions, check conservation laws and symmetries, run convergence tests (error should fall at the expected order as step size shrinks), and use `np.testing.assert_allclose` with stated `rtol` and `atol`. Property-based tests (Hypothesis) catch edge cases such as zeros, huge values and NaN.

   **Check:** Tests state their tolerances and fail when a deliberate bug is introduced.

8. **Record provenance.** Save outputs with a manifest: git commit, lockfile hash, parameters, seeds, input data checksums and runtime environment.

## Reference

### Stability fixes

| Problem | Symptom | Fix |
| :--- | :--- | :--- |
| Catastrophic cancellation | Loss of digits in `a - b` with `a` close to `b` | Reformulate algebraically; use `log1p`, `expm1`, `hypot` |
| Overflow in `exp` | `inf`, then NaN | Log-sum-exp: subtract the max before exponentiating |
| Summation error | Drift in long sums | `math.fsum`, pairwise sum, Kahan summation |
| Ill-conditioned solve | Huge sensitivity to inputs | `solve`/`lstsq`, regularization, rescaling, check `cond` |
| Variance by naive formula | Negative or noisy variance | Welford's algorithm or `np.var` on centred data |
| Float equality | Flaky comparisons | `np.isclose` / `assert_allclose` with tolerances |

```python
from scipy.special import logsumexp
log_probs = scores - logsumexp(scores)       # stable log-softmax
```

### Determinism caveats

Multithreaded BLAS, GPU kernels and parallel reductions can change summation order and the last bits of results. For bitwise reproducibility, fix thread counts (`OMP_NUM_THREADS`, `OPENBLAS_NUM_THREADS`, `MKL_NUM_THREADS`) and use deterministic modes where the library offers them; otherwise define and test tolerances.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `np.linalg.inv(A) @ b` | `np.linalg.solve(A, b)` | Slower and less accurate |
| Global `np.random.seed` in library code | Pass a `Generator` in | Hidden global state breaks reproducibility and parallelism |
| Python loops over array elements | Vectorize, then Numba if still needed | Interpreter overhead dominates |
| Compare floats with `==` | Tolerances that reflect the problem scale | Rounding makes exact equality accidental |
| Ignore solver warnings and status | Check status, tolerances and iteration counts | Non-converged results look like real ones |
| "Works on my machine" figures | Lockfile, seeds, manifest with checksums | Results that cannot be reproduced cannot be trusted |

## Verification checklist

- [ ] Environment is locked and recorded with BLAS and hardware info.
- [ ] Randomness flows from logged seeds via Generators.
- [ ] Hot paths are vectorized or accelerated, with profiling evidence.
- [ ] Stability checked under perturbation and precision changes.
- [ ] Solver statuses checked; tests use stated tolerances and convergence checks.
- [ ] Outputs carry a provenance manifest.

## Related

- Knowledge: `python-patterns`, `python-testing`, `jupyter-notebooks`, `profiling`, `operations-research`, `time-series-forecasting`, `bioinformatics`, `geospatial-gis`.
- Workflows: `/perf-audit`, `/verify`.
- Agents: `python-reviewer`, `ml-engineer`, `data-analyst`.
