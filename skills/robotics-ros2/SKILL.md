---
name: robotics-ros2
disable-model-invocation: true
description: >-
  Builds robot software with ROS 2: workspaces and colcon, nodes, topics,
  services, actions and parameters, QoS profiles, launch files, tf2 frames,
  simulation with Gazebo, navigation with Nav2, ros2_control, bag recording
  and introspection, plus safety practice for real hardware. Use when
  creating or debugging ROS 2 packages, wiring sensors and controllers, or
  moving from simulation to a physical robot.
---

# Robotics with ROS 2

ROS 2 is a graph of nodes exchanging typed messages over DDS. Most problems
are mismatched QoS, wrong coordinate frames, timing, or launch configuration,
not algorithms. Build in simulation first, introspect the graph constantly,
and treat commands to real hardware as safety-critical.

## When to use

- Creating ROS 2 packages, nodes, interfaces and launch files (Python or C++).
- Integrating sensors (lidar, cameras, IMU), controllers and navigation.
- Debugging "no data on topic", TF errors, latency or dropped messages.
- Setting up simulation, bag-based testing and CI for a robot stack.

## When not to use

- Microcontroller firmware under the robot (motor drivers, sensor MCUs): use `embedded-firmware`.
- Fleet telemetry to the cloud: use `iot-mqtt`.
- Vision model training: use `computer-vision`; motion planning research math beyond ROS tooling is out of scope.

## Workflow

1. **Pin the distribution.** Choose an LTS distribution supported for your target OS (for example Humble on Ubuntu 22.04, Jazzy on Ubuntu 24.04) and keep every machine and container on it. Check the ROS 2 releases page for current support windows.

   **Check:** `printenv ROS_DISTRO` matches on every machine and in CI.

2. **Create a workspace and package.**

   ```bash
   mkdir -p ~/ros2_ws/src && cd ~/ros2_ws/src
   ros2 pkg create --build-type ament_python --dependencies rclpy std_msgs my_robot
   cd ~/ros2_ws && rosdep install --from-paths src -y --ignore-src
   colcon build --symlink-install
   source install/setup.bash        # Windows: call install\setup.bat (cmd) or install\setup.ps1 (PowerShell)
   ```

   **Check:** `ros2 pkg list | grep my_robot` finds the package in a new shell after sourcing.

3. **Write small, single-purpose nodes.** Publish and subscribe with explicit QoS; use parameters for configuration; use services for quick request/response and actions for long-running goals with feedback and cancel.

   ```python
   import rclpy
   from rclpy.node import Node
   from rclpy.qos import qos_profile_sensor_data
   from sensor_msgs.msg import LaserScan

   class ObstacleWatch(Node):
       def __init__(self):
           super().__init__("obstacle_watch")
           self.declare_parameter("stop_distance_m", 0.5)
           self.create_subscription(LaserScan, "scan", self.on_scan, qos_profile_sensor_data)

       def on_scan(self, msg: LaserScan):
           limit = self.get_parameter("stop_distance_m").value
           valid = [r for r in msg.ranges if msg.range_min < r < msg.range_max]
           if valid and min(valid) < limit:
               self.get_logger().warn(f"obstacle at {min(valid):.2f} m")

   def main():
       rclpy.init()
       node = ObstacleWatch()
       try:
           rclpy.spin(node)
       finally:
           node.destroy_node()
           rclpy.shutdown()
   ```

   **Check:** `ros2 node info /obstacle_watch` shows the expected subscriptions and parameters.

4. **Match QoS on both ends.** Sensor streams: best effort, volatile, small depth. Commands and state: reliable. Late-joining consumers of static data (maps, robot description): transient local. Incompatible QoS produces no data and only a warning.

   **Check:** `ros2 topic info -v /scan` shows compatible reliability and durability for publisher and subscribers.

5. **Get frames right.** Follow REP 105 (`map -> odom -> base_link -> sensor frames`). Publish static transforms for fixed sensors, stamp messages with the correct frame and time, and use simulated time consistently (`use_sim_time`) in simulation.

   **Check:** `ros2 run tf2_tools view_frames` produces a single connected tree with no stale transforms.

6. **Compose with launch files.** Use Python launch files with arguments, parameter YAML files, namespaces and remappings so the same nodes run in simulation and on hardware.

   **Check:** `ros2 launch my_robot bringup.launch.py use_sim:=true` and `use_sim:=false` both start cleanly.

7. **Simulate, record and replay.** Run the stack in Gazebo (via `ros_gz` bridges) before hardware. Record specific topics with `ros2 bag record /scan /odom /tf /tf_static` and replay bags in tests to reproduce bugs.

   **Check:** A recorded bag reproduces the bug deterministically in CI or on a laptop.

8. **Move to hardware deliberately.** Verify a hardware emergency stop that does not depend on software, cap velocities and accelerations in the controller, test on blocks or in a clear area, and ask the user to confirm before publishing any command that moves real hardware.

   **Check:** E-stop, velocity limits and a command timeout (robot stops when commands stop arriving) are tested before autonomous runs.

## Reference

### Introspection commands

| Command | Use |
| :--- | :--- |
| `ros2 node list`, `ros2 node info <node>` | What is running and how it is wired |
| `ros2 topic list -t`, `ros2 topic echo <topic>` | Topics with types; inspect messages |
| `ros2 topic hz <topic>`, `ros2 topic bw <topic>` | Rate and bandwidth |
| `ros2 param list`, `ros2 param get <node> <name>` | Runtime configuration |
| `ros2 service call`, `ros2 action send_goal` | Exercise interfaces by hand |
| `ros2 doctor --report` | Environment and network sanity |
| `rqt_graph` | Visual graph |

### Common stacks

| Need | Package |
| :--- | :--- |
| Navigation (planning, control, recovery behaviour trees) | Nav2 |
| Mapping and localization | SLAM Toolbox, AMCL (in Nav2) |
| Hardware interfaces and controllers | ros2_control, ros2_controllers |
| Manipulation | MoveIt 2 |
| Simulation | Gazebo with ros_gz |

### DDS and networking

Use `ROS_DOMAIN_ID` to isolate robots on a shared network. Multicast discovery often fails across Wi-Fi, VPNs and containers; use the middleware's discovery-server or static peer configuration, and check the docs for your selected RMW implementation.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Default QoS everywhere | Choose QoS per stream and verify compatibility | Mismatches silently drop all data |
| Hardcode topic names and frames | Parameters, remapping and namespaces | Multi-robot and sim-to-real need different names |
| Mix wall time and sim time | Set `use_sim_time` consistently in simulation | TF lookups fail with extrapolation errors |
| `ros2 bag record -a` on a robot with cameras | Record the topics you need | Disks fill fast and bags become unusable |
| Rely on software for emergency stop | Hardware e-stop plus software limits | Software crashes; motors keep the last command |
| Develop only on hardware | Simulate and replay bags first | Hardware time is scarce and crashes are expensive |

## Verification checklist

- [ ] Distribution is pinned across machines, containers and CI.
- [ ] Nodes declare parameters; QoS is explicit and compatible.
- [ ] TF tree is connected, frames follow REP 105, timestamps are correct.
- [ ] Launch files run unchanged in simulation and on hardware via arguments.
- [ ] Bugs are reproducible from bags; tests run headless.
- [ ] Hardware e-stop, limits and command timeouts are verified; motion commands were confirmed by the user.

## Related

- Knowledge: `embedded-firmware`, `iot-mqtt`, `computer-vision`, `python-patterns`, `cpp-modern`, `docker-containers`.
- Workflows: `/root-cause`, `/e2e`.
- Agents: `cpp-reviewer`, `python-reviewer`.
