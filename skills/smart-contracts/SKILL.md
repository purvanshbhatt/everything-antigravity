---
name: smart-contracts
description: >-
  Smart contract security and testing for Solidity: checks-effects-
  interactions and reentrancy, access control, signature replay, oracle and
  MEV risks, token edge cases, upgradeable proxy pitfalls, Foundry unit, fuzz,
  invariant and fork tests, Slither static analysis, audit preparation and
  safe deployment key handling. Use when writing, reviewing, testing or
  preparing Solidity contracts for audit. No financial advice.
---

# Smart Contracts: Security and Testing

Deployed contracts are public, adversarial and usually immutable, and bugs
lose real funds within minutes. Use audited libraries, follow
checks-effects-interactions, test with fuzzing and invariants, and treat
deployment keys and upgrade rights as the crown jewels.

> Security and engineering guidance only: no financial, investment or legal advice. An audit reduces risk; it does not guarantee safety.

## When to use

- Writing or reviewing Solidity contracts and their tests.
- Preparing for an external audit or a bug bounty.
- Designing upgradeability, admin roles, oracles or signature-based flows.
- Planning a deployment to testnet or mainnet.

## When not to use

- Off-chain backend ledgers and payment flows: use `fintech-ledgers` and `payments-stripe`.
- General cryptography choices: use `cryptography`.
- Token economics or investment decisions: out of scope; refer to qualified professionals.

## Workflow

1. **Set up Foundry with pinned dependencies.**

   ```bash
   forge init vault && cd vault
   forge install OpenZeppelin/openzeppelin-contracts      # pin to a release tag
   forge build && forge test -vvv
   ```

   **Check:** `foundry.toml` pins the compiler version; dependencies are pinned to tagged releases.

2. **Write contracts on audited building blocks.** Use OpenZeppelin for tokens, access control (`Ownable2Step`, `AccessControl`), `ReentrancyGuard`, `SafeERC20`, `Pausable` and signatures (`ECDSA`, `EIP712`). Follow checks-effects-interactions.

   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.24;
   import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

   contract Vault is ReentrancyGuard {
       mapping(address => uint256) public balanceOf;

       function deposit() external payable { balanceOf[msg.sender] += msg.value; }

       function withdraw(uint256 amount) external nonReentrant {
           uint256 bal = balanceOf[msg.sender];
           require(amount <= bal, "insufficient");            // checks
           balanceOf[msg.sender] = bal - amount;              // effects
           (bool ok, ) = msg.sender.call{value: amount}("");  // interactions last
           require(ok, "transfer failed");
       }
   }
   ```

   **Check:** Every external call happens after state updates, and its return value is checked.

3. **Test properties, not just examples.** Unit tests for each function and revert path, fuzz tests for arithmetic and bounds, invariant tests for system-wide truths (total supply equals the sum of balances, the vault holds at least what it owes), and fork tests against real deployed dependencies.

   ```solidity
   import {Test} from "forge-std/Test.sol";

   contract VaultTest is Test {
       Vault vault;
       function setUp() public { vault = new Vault(); }
       receive() external payable {}

       function testFuzz_cannotWithdrawMoreThanDeposited(uint96 dep, uint96 wd) public {
           vm.deal(address(this), dep);
           vault.deposit{value: dep}();
           if (wd > dep) vm.expectRevert();
           vault.withdraw(wd);
       }
   }
   ```

   Run `forge test`, `forge coverage`, and invariant suites (functions prefixed `invariant_` with handler contracts). Fork tests use `forge test --fork-url <RPC_URL>`.

   **Check:** Branch coverage is high on value-moving code, and invariants hold across long fuzz runs.

4. **Run static analysis.** `slither .` on every change; triage each detector result. Add Echidna, Medusa or symbolic tools (Halmos) for critical math.

   **Check:** No unexplained High or Medium detector results remain.

5. **Review against the attack checklist** (table below). Delegate an independent pass to the `security-guard` subagent with the contracts, tests and threat model.

   **Check:** Each checklist row is marked handled or not applicable with a reason.

6. **Prepare the audit.** Freeze scope at a commit, document roles, trust assumptions, invariants, external dependencies and known issues, and ship a passing test suite. Fix findings with tests that reproduce them.

   **Check:** Auditors can build and run tests from a clean clone with one command.

7. **Deploy safely.** Testnet first with the same scripts. Never put private keys in the repository, `.env` files or shell history; use an encrypted keystore (`cast wallet import <name> --interactive`, then `forge script ... --account <name>`) or a hardware wallet. Transfer ownership and upgrade rights to a multisig behind a timelock. Ask the user for explicit confirmation before any broadcast to a mainnet.

   **Check:** Verified source on the block explorer, admin roles held by the multisig, and a monitoring and incident plan (pause, communication) in place.

## Reference

### Attack checklist

| Risk | Control |
| :--- | :--- |
| Reentrancy (including cross-function and read-only) | Checks-effects-interactions, `nonReentrant`, no state reads by others mid-call |
| Missing or weak access control | Explicit roles, `Ownable2Step`, events on role changes, no `tx.origin` auth |
| Signature replay | EIP-712 domain with chain ID and contract, per-signer nonces, deadlines, library ECDSA |
| Oracle manipulation | No spot AMM prices; validate staleness and bounds of oracle data; TWAPs where suitable |
| Front-running and MEV | Slippage limits, deadlines, commit-reveal where needed |
| Token edge cases | `SafeERC20`; measure balance deltas for fee-on-transfer; beware rebasing and hooks |
| Rounding and share inflation | Round in the protocol's favour; virtual shares or offsets for vaults |
| Denial of service | Pull payments, bounded loops, no reliance on external call success for core flows |
| Unsafe `delegatecall` and initialization | Only to trusted code; initializers protected |

### Upgradeable proxies

| Pitfall | Control |
| :--- | :--- |
| Uninitialized implementation | Call `_disableInitializers()` in the implementation constructor |
| Storage layout collisions | Append-only layout or ERC-7201 namespaced storage; validate with upgrade-safety tooling |
| Unauthorized upgrade | `_authorizeUpgrade` restricted to a timelocked multisig (UUPS) |
| Silent behaviour change | Upgrade proposals reviewed, tested on a fork, announced before execution |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| External call before updating balances | Checks-effects-interactions plus a guard | Classic reentrancy drains |
| `require(tx.origin == owner)` | `msg.sender` with role checks | Phishing contracts can satisfy `tx.origin` |
| Raw `ecrecover` without nonce or domain | EIP-712 plus nonces and library ECDSA | Signatures replay across calls and chains |
| Deployer EOA keeps admin rights | Multisig plus timelock | One leaked key controls everything |
| Private key in `.env` committed by mistake | Encrypted keystore or hardware wallet | Bots sweep leaked keys within seconds |
| Treat an audit as a guarantee | Tests, invariants, monitoring, bounty | Audits are time-boxed samples |

## Verification checklist

- [ ] Compiler and dependencies pinned; audited libraries used.
- [ ] Checks-effects-interactions everywhere; external call results checked.
- [ ] Unit, fuzz, invariant and fork tests pass; coverage reviewed.
- [ ] Slither results triaged; attack checklist completed.
- [ ] Upgrade and admin rights sit with a timelocked multisig.
- [ ] No keys in the repo; mainnet broadcast was confirmed by the user.

## Related

- Knowledge: `cryptography`, `security-audit`, `supply-chain-security`, `fintech-ledgers`, `static-analysis`.
- Workflows: `/threat-modeling`, `/code-review`, `/security-scan`.
- Agents: `security-guard`, `code-reviewer`.
