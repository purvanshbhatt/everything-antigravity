#!/usr/bin/env node
// Verify a rendered video against a spec with ffprobe and ffmpeg's ebur128 filter.
// Zero dependencies; needs ffprobe and ffmpeg on PATH.
//
// Usage:
//   node verify-video.mjs <file> [--width 1920] [--height 1080] [--fps 30]
//     [--duration 45] [--duration-tolerance 0.1] [--max-duration 60]
//     [--lufs -14] [--lufs-tolerance 1] [--max-true-peak -1] [--yuv420p 1] [--audio 1]
//
// Prints a JSON report to stdout. Exit code: 0 = all checks pass, 1 = a check
// failed, 2 = usage error or ffprobe/ffmpeg could not run.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function parseArgs(argv) {
  const [file, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const raw = rest[i + 1];
    if (!key || !key.startsWith('--') || raw === undefined) {
      throw new Error(`Bad argument near "${key ?? ''}"; expected --name <number>`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Expected a number for ${key}, got "${raw}"`);
    opts[key.slice(2)] = value;
  }
  return { file, opts };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`${cmd} could not start: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}: ${String(r.stderr).slice(-500)}`);
  return r;
}

function rate(value) {
  const [n, d] = String(value ?? '').split('/').map(Number);
  if (!Number.isFinite(n)) return NaN;
  return d ? n / d : n;
}

function dbValue(match) {
  if (!match) return null;
  return match[1] === '-inf' ? -Infinity : Number(match[1]);
}

function measureLoudness(file) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0',
    '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-']);
  const log = String(r.stderr);
  const summary = log.slice(log.lastIndexOf('Summary:'));
  return {
    integratedLufs: dbValue(summary.match(/I:\s+(-?[\d.]+|-inf) LUFS/)),
    truePeakDbtp: dbValue(summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/)),
  };
}

function main() {
  let file;
  let opts;
  try {
    ({ file, opts } = parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(err.message);
    return 2;
  }
  if (!file || !existsSync(file)) {
    console.error(`File not found: ${file ?? '(none given)'}`);
    return 2;
  }

  const checks = [];
  const check = (name, actual, expected, ok) => checks.push({ name, actual, expected, ok: Boolean(ok) });
  const info = {};

  try {
    const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]).stdout);
    const v = probe.streams.find((s) => s.codec_type === 'video');
    const a = probe.streams.find((s) => s.codec_type === 'audio');
    const duration = Number(probe.format?.duration);
    info.duration = duration;
    info.container = probe.format?.format_name;

    check('video_stream', Boolean(v), true, v);
    if (v) {
      const avg = rate(v.avg_frame_rate);
      const fps = Number.isFinite(avg) && avg > 0 ? avg : rate(v.r_frame_rate);
      Object.assign(info, { videoCodec: v.codec_name, pixFmt: v.pix_fmt, width: v.width, height: v.height, fps,
        likelyVariableFrameRate: Math.abs(rate(v.r_frame_rate) - fps) > 0.01 });
      if (opts.width !== undefined) check('width', v.width, opts.width, v.width === opts.width);
      if (opts.height !== undefined) check('height', v.height, opts.height, v.height === opts.height);
      if (opts.fps !== undefined) check('fps', Number(fps.toFixed(3)), opts.fps, Math.abs(fps - opts.fps) < 0.01);
      if (opts.yuv420p) check('pix_fmt', v.pix_fmt, 'yuv420p', v.pix_fmt === 'yuv420p');
    }
    if (opts.duration !== undefined) {
      const tol = opts['duration-tolerance'] ?? 0.1;
      check('duration', duration, `${opts.duration} ±${tol}`, Math.abs(duration - opts.duration) <= tol);
    }
    if (opts['max-duration'] !== undefined) {
      check('max_duration', duration, `<= ${opts['max-duration']}`, duration <= opts['max-duration']);
    }

    const needAudio = Boolean(opts.audio) || opts.lufs !== undefined || opts['max-true-peak'] !== undefined;
    if (needAudio) check('audio_stream', Boolean(a), true, a);
    if (a) {
      Object.assign(info, { audioCodec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels });
      const loud = measureLoudness(file);
      Object.assign(info, loud);
      if (opts.lufs !== undefined) {
        const tol = opts['lufs-tolerance'] ?? 1;
        check('integrated_lufs', loud.integratedLufs, `${opts.lufs} ±${tol}`,
          loud.integratedLufs !== null && Math.abs(loud.integratedLufs - opts.lufs) <= tol);
      }
      if (opts['max-true-peak'] !== undefined) {
        check('true_peak_dbtp', loud.truePeakDbtp, `<= ${opts['max-true-peak']}`,
          loud.truePeakDbtp !== null && loud.truePeakDbtp <= opts['max-true-peak']);
      }
    }
  } catch (err) {
    console.error(err.message);
    return 2;
  }

  const pass = checks.every((c) => c.ok);
  console.log(JSON.stringify({ file, pass, checks, info }, null, 2));
  return pass ? 0 : 1;
}

process.exitCode = main();
