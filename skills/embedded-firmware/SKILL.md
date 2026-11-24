---
name: embedded-firmware
disable-model-invocation: true
description: >-
  Embedded firmware for microcontrollers: MCU memory and startup, interrupts
  and concurrency, RTOS basics (FreeRTOS, Zephyr), HAL and SDK toolchains
  (STM32, ESP-IDF, Pico SDK, embedded Rust), debugging over SWD/JTAG with
  OpenOCD and GDB, HardFault triage, host and hardware-in-the-loop tests,
  signed OTA with rollback, and power optimization. Use when writing,
  debugging or reviewing MCU firmware.
---

# Embedded Firmware

Firmware fails in ways desktop code does not: stack overflows with no error,
races with interrupts, silent memory corruption and bricked devices. Keep ISRs
tiny, allocate statically, test logic on the host, and make every update
recoverable.

## When to use

- Writing or reviewing C, C++ or Rust for Cortex-M, ESP32, RP2040/RP2350 or similar MCUs.
- Structuring an application on FreeRTOS or Zephyr, or deciding whether you need an RTOS.
- Debugging HardFaults, resets, watchdog trips, timing or power problems.
- Designing bootloaders and OTA update paths.

## When not to use

- Device-to-cloud messaging, provisioning and fleet OTA orchestration: use `iot-mqtt`.
- Embedded Linux user space and services: use `linux-admin` and `c-systems-programming`.
- Robot middleware on Linux SBCs: use `robotics-ros2`.
- General modern C++ guidance: use `cpp-modern`.

## Workflow

1. **Know the target.** Record MCU part, core, clock, flash and RAM sizes, memory map, toolchain and SDK versions, debug probe, and board revision. Read the linker script and startup file before changing memory layout.

   **Check:** You can state where `.text`, `.data`, `.bss`, heap and each task stack live, and how much RAM is free (`arm-none-eabi-size build/app.elf` plus the map file).

2. **Build reproducibly with warnings as errors.** Pin the toolchain (container or SDK manager). Use `-Wall -Wextra -Werror`, `-ffunction-sections -fdata-sections -Wl,--gc-sections`, and a map file.

   ```bash
   idf.py set-target esp32s3 && idf.py build                 # ESP-IDF
   west build -b <board> app                                  # Zephyr
   cmake -S . -B build -G Ninja && cmake --build build        # Pico SDK / STM32 CMake
   ```

   **Check:** A clean checkout builds the identical binary size on CI and on a developer machine.

3. **Structure concurrency.** ISRs only acknowledge hardware, capture data and defer work (queue, task notification, flag). Use the `FromISR` API variants inside ISRs. Share data through queues or critical sections; `volatile` is for hardware registers and ISR-visible flags, not for atomicity. Use mutexes (priority inheritance) rather than binary semaphores for shared resources.

   ```c
   void UART_IRQHandler(void) {
       BaseType_t woken = pdFALSE;
       uint8_t byte = UART->DR;                       // read clears the interrupt
       xQueueSendFromISR(rx_queue, &byte, &woken);    // defer processing to a task
       portYIELD_FROM_ISR(woken);
   }
   ```

   **Check:** No ISR blocks, allocates, logs over a slow UART or calls a non-ISR-safe API.

4. **Size stacks and avoid the heap.** Allocate statically at init; avoid `malloc` after startup. Enable stack overflow checking (FreeRTOS `configCHECK_FOR_STACK_OVERFLOW`, Zephyr stack sentinels) and measure with `uxTaskGetStackHighWaterMark`.

   **Check:** Every task keeps a documented safety margin under worst-case load.

5. **Test logic off-target.** Put hardware access behind a thin HAL interface; unit-test the rest on the host with Unity/CMock (Ceedling), GoogleTest or `cargo test`. Use emulators (Renode, QEMU) and a hardware-in-the-loop rig for drivers and timing.

   **Check:** Protocol parsers, state machines and control logic have host tests that run in CI in seconds.

6. **Debug with a probe, not printf alone.**

   ```bash
   openocd -f interface/stlink.cfg -f target/stm32f4x.cfg
   arm-none-eabi-gdb build/app.elf -ex "target extended-remote :3333" -ex "monitor reset halt"
   ```

   On a HardFault (Cortex-M3/M4/M7), read CFSR, HFSR, MMFAR and BFAR, and the stacked PC and LR, then map the PC to source with `addr2line`. Use RTT or ITM/SWO for low-overhead logging.

   **Check:** The fault is explained by a specific instruction and cause (bad pointer, unaligned access, stack overflow, divide by zero).

7. **Make updates recoverable.** Use a bootloader with signed images and A/B (or swap) slots, such as MCUboot or ESP-IDF OTA with app rollback, and mark the new image good only after a self-test. Keep a hardware watchdog running and enable brownout detection.

   **Check:** Power-cutting during an update and booting a deliberately broken image both return to a working image.

8. **Measure and reduce power.** Measure current with a power profiler, not estimates. Use the deepest sleep mode compatible with wake sources, gate peripheral clocks, configure unused GPIOs, batch radio activity and duty-cycle sensors.

   **Check:** Sleep current and average current per duty cycle are measured and recorded against the battery budget.

## Reference

### Irreversible operations (always ask the user first)

| Operation | Why it is dangerous |
| :--- | :--- |
| Burning eFuses or OTP (secure boot, flash encryption, JTAG disable) | Permanent; wrong keys or settings can brick the chip |
| Mass erase or option-byte changes (readout protection levels) | Can wipe calibration data or lock debug access permanently |
| Flashing devices in the field or production lines | Affects real users and hardware |

### RTOS or bare metal

| Situation | Choice |
| :--- | :--- |
| One main loop, few timing constraints | Bare-metal super-loop with interrupts |
| Several independent activities, blocking I/O, networking stacks | FreeRTOS or Zephyr |
| Rich drivers, networking, Bluetooth, devicetree-based portability | Zephyr |
| Memory safety and async without an RTOS | Embedded Rust with an async executor such as Embassy |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Process data inside the ISR | Capture, defer to a task | Long ISRs cause missed interrupts and jitter |
| Use `volatile` for thread safety | Critical sections, atomics or queues | `volatile` prevents caching, not races |
| `malloc` in steady state | Static allocation or fixed pools | Fragmentation causes failures after days of uptime |
| Disable the watchdog during development and forget | Keep it on; feed it from a health-checked task | Hangs in the field become permanent |
| Ship updates without rollback | Signed A/B images with self-test confirmation | One bad update bricks devices remotely |
| Debug only with printf | SWD debugger, fault registers, RTT | printf changes timing and hides races |

## Verification checklist

- [ ] Memory map, stack sizes and free RAM are known and documented.
- [ ] Builds are reproducible with warnings as errors and a map file.
- [ ] ISRs are short and use only ISR-safe APIs; shared data is protected.
- [ ] Logic has host tests in CI; drivers are exercised on HIL or an emulator.
- [ ] Updates are signed, recoverable and tested against power loss.
- [ ] Irreversible chip operations were confirmed by the user before running.

## Related

- Knowledge: `iot-mqtt`, `c-systems-programming`, `cpp-modern`, `cpp-testing`, `rust-systems`, `robotics-ros2`, `cryptography`.
- Workflows: `/root-cause`, `/release-management`.
- Agents: `cpp-reviewer`, `rust-reviewer`, `cpp-build-resolver`.
