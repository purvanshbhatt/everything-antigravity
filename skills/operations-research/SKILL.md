---
name: operations-research
disable-model-invocation: true
description: >-
  Formulates and solves optimization problems: linear and mixed-integer
  programming, constraint programming with OR-Tools CP-SAT, vehicle routing
  with time windows and capacities, shift and job-shop scheduling, solver
  choice (HiGHS, SCIP, CP-SAT, commercial), modelling pitfalls, infeasibility
  diagnosis and solution validation. Use when the user needs to allocate,
  schedule, route, assign or plan under constraints.
---

# Operations Research

Write the model in plain language first (decisions, objective, constraints),
then encode it in a modelling layer, solve with a time limit, and check the
answer independently. Most failures are formulation errors, not solver
limitations.

## When to use

- Scheduling shifts, jobs, rooms or machines; assigning people to tasks.
- Routing vehicles or technicians with capacities and time windows.
- Allocating budget, inventory or capacity under constraints.
- A greedy heuristic in production is leaving value on the table or breaking rules.

## When not to use

- Fitting models to data or forecasting demand: use `time-series-forecasting` or `ml-evaluation`.
- Continuous numerical optimization of physics or curve fitting: use `scientific-computing` (SciPy).
- Spreadsheet what-if models: use `spreadsheet-modeling`.
- Map data handling and distance matrices from GIS layers: use `geospatial-gis` alongside this skill.

## Workflow

1. **State the problem in words.** Decision variables (what you choose), objective (what you minimize or maximize, with units), hard constraints (never violated), soft constraints (penalized), and data sources. Get the user to confirm the priorities among competing goals.

   **Check:** A one-page formulation exists and a domain expert agrees it describes the real problem.

2. **Choose the paradigm and solver.**

   | Problem shape | Paradigm | Solvers |
   | :--- | :--- | :--- |
   | Continuous variables, linear constraints | LP | HiGHS, GLOP, commercial solvers |
   | Some integer or yes/no decisions | MIP | HiGHS, SCIP, CP-SAT (integer data), Gurobi, CPLEX |
   | Scheduling, sequencing, logical rules, all-integer | Constraint programming | OR-Tools CP-SAT |
   | Vehicle routing with time windows and capacities | Routing heuristics and metaheuristics | OR-Tools routing library, Route Optimization API on Google Maps Platform |

   **Check:** The choice is justified by variable types and constraint shapes, not habit.

3. **Build a tiny instance first.** Encode a toy version you can solve by hand, then scale.

   ```python
   from ortools.sat.python import cp_model

   # Assign workers to shifts: each shift needs 1 worker, each worker <= max_shifts
   workers, shifts, max_shifts = range(4), range(6), 2
   model = cp_model.CpModel()
   x = {(w, s): model.new_bool_var(f"x_{w}_{s}") for w in workers for s in shifts}
   for s in shifts:
       model.add_exactly_one(x[w, s] for w in workers)
   for w in workers:
       model.add(sum(x[w, s] for s in shifts) <= max_shifts)
   pref = {(w, s): (w * 7 + s * 3) % 5 for w in workers for s in shifts}   # stand-in preference scores
   model.maximize(sum(pref[k] * x[k] for k in x))

   solver = cp_model.CpSolver()
   solver.parameters.max_time_in_seconds = 10.0
   solver.parameters.num_workers = 8
   status = solver.solve(model)
   if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
       plan = [(w, s) for (w, s), v in x.items() if solver.value(v)]
   ```

   Recent OR-Tools releases use snake_case methods (`new_bool_var`, `solve`); older ones use CamelCase. Check the installed version.

   **Check:** The toy instance returns the answer you computed by hand.

4. **Scale with structure.** Scale constraints to real data; for MIPs prefer tight formulations (small big-M values derived from data, or indicator constraints), break symmetry (order identical resources), and use integer data for CP-SAT (scale decimals). Always set a time limit and log the optimality gap.

   **Check:** Solve time and gap on realistic instances are measured and within the business's time budget.

5. **Diagnose infeasibility methodically.** Relax hard constraints into penalized soft constraints one group at a time, or compute an irreducible infeasible subset with solvers that support it. With CP-SAT, add assumption literals per constraint group and ask for the sufficient assumptions for infeasibility.

   **Check:** You can name the minimal set of conflicting rules and show it to the user.

6. **Validate the solution independently.** Write a checker that takes the solution and raw data and verifies every hard constraint and recomputes the objective, without using the model code. Compare against the current heuristic or manual plan.

   **Check:** The checker passes on every solution, and the improvement over the baseline is quantified.

7. **Operationalize.** Version the model with its data schema, add regression instances with known objective values to CI, monitor solve time, gap and infeasibility rate in production, and keep a fallback heuristic for timeouts. Ask the user before publishing schedules or routes that people or vehicles will act on.

## Reference

### Modelling tricks

| Need | Technique |
| :--- | :--- |
| Logical "if A then B" | Implications (`add(...).only_enforce_if(b)` in CP-SAT) or indicator constraints in MIP |
| Either/or constraints | Binary selector with tight big-M, or CP-SAT enforcement literals |
| No overlap on a machine | CP-SAT interval variables with `add_no_overlap` |
| Resource capacity over time | `add_cumulative` on interval variables |
| Multiple objectives | Lexicographic: solve for the first, fix it as a constraint, solve the next; or weighted sum with explicit weights |
| Fairness | Minimize the maximum load, or add penalties on deviation from the mean |

### Python modelling layers

| Library | Notes |
| :--- | :--- |
| OR-Tools (CP-SAT, linear solver, MathOpt, routing) | Free; CP-SAT is strong on scheduling and assignment |
| PuLP | Simple LP/MIP modelling; ships with a default open-source solver |
| Pyomo | Algebraic modelling, many solvers, nonlinear support |
| highspy | Direct HiGHS bindings for LP/MIP |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start coding the model before the formulation is agreed | Plain-language formulation reviewed by the domain owner | Optimal answers to the wrong problem waste weeks |
| Huge big-M constants | Data-derived tight bounds or indicator constraints | Weak relaxations and numerical trouble |
| Run without a time limit | Time limit plus gap logging | Some instances never prove optimality |
| Trust the solver's objective | Independent solution checker | Formulation bugs produce "optimal" invalid plans |
| Make every rule hard | Separate hard and soft constraints with penalties | Real-world data is often infeasible under all rules |
| Float coefficients in CP-SAT | Scale to integers | CP-SAT requires integer coefficients |

## Verification checklist

- [ ] Decisions, objective, hard and soft constraints are written and confirmed.
- [ ] Paradigm and solver choice is justified.
- [ ] A toy instance matches a hand-computed answer.
- [ ] Time limits are set; gap and solve time are logged.
- [ ] An independent checker validates every solution against raw data.
- [ ] Regression instances run in CI; publishing plans required user confirmation.

## Related

- Knowledge: `scientific-computing`, `geospatial-gis`, `time-series-forecasting`, `spreadsheet-modeling`, `python-patterns`, `python-testing`.
- Workflows: `/write-spec`, `/verify`.
- Agents: `data-analyst`, `python-reviewer`.
